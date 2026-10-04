import { createLocalAccountIssuer } from "@better-auth/core/db";
import bcrypt from "bcryptjs";
import { prisma } from "@formbricks/database";

export type SeededUser = {
  userId: string;
  email: string;
  password: string;
  organizationId: string;
  workspaceId: string;
};

/**
 * Creates an isolated user with its own organization and workspace, as Formbricks's own Playwright
 * fixture does, and waits until Formbricks has projected them into its authorization store.
 */
export async function seedUser(): Promise<SeededUser> {
  const name = `ayme-lab-${process.pid}-${Date.now()}`;
  const email = `${name}@example.com`;
  const hashedPassword = await bcrypt.hash(name, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      emailVerified: true,
      locale: "en-US",
      memberships: {
        create: {
          organization: {
            create: {
              name: "Ayme Lab",
              billing: {
                create: {
                  limits: { workspaces: 3, monthly: { responses: 1500 } },
                  stripeCustomerId: null,
                  usageCycleAnchor: new Date(),
                },
              },
              workspaces: { create: { name: "Ayme Lab Workspace" } },
            },
          },
          role: "owner",
        },
      },
    },
    include: { memberships: true },
  });

  // Better Auth signs in against a credential account with the local issuer.
  await prisma.account.create({
    data: {
      userId: user.id,
      type: "credential",
      provider: "credential",
      providerAccountId: user.id,
      issuer: createLocalAccountIssuer("credential"),
      password: hashedPassword,
    },
  });

  const organizationId = user.memberships[0].organizationId;
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { organizationId } });
  await prisma.contactAttributeKey.createMany({
    data: [
      { name: "Email", key: "email", isUnique: true, type: "default", workspaceId: workspace.id },
      { name: "First Name", key: "firstName", isUnique: false, type: "default", workspaceId: workspace.id },
      { name: "Last Name", key: "lastName", isUnique: false, type: "default", workspaceId: workspace.id },
      { name: "userId", key: "userId", isUnique: true, type: "default", workspaceId: workspace.id },
    ],
  });

  await waitForAuthorization([user.id, organizationId, workspace.id]);
  return { userId: user.id, email, password: name, organizationId, workspaceId: workspace.id };
}

/**
 * Formbricks checks access through its authorization store, which a background worker fills from
 * PostgreSQL a second or more after each write. Waits until every outbox event about these records
 * is delivered; signing in earlier lands on "create organization".
 */
export async function waitForAuthorization(ids: string[], timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const events = await prisma.authzedProjectionOutbox.findMany({
      where: { OR: [{ primaryId: { in: ids } }, { secondaryId: { in: ids } }] },
      select: { targetType: true, processedAt: true, deadLetteredAt: true },
    });
    const deadLettered = events.filter((event) => event.deadLetteredAt);
    if (deadLettered.length > 0)
      throw new Error(
        `Formbricks dead-lettered the authorization events for ${deadLettered.map((e) => e.targetType).join(", ")}.`
      );
    const pending = events.filter((event) => !event.processedAt);
    if (events.length > 0 && pending.length === 0) return;
    if (Date.now() > deadline)
      throw new Error(
        `Formbricks did not deliver ${events.length === 0 ? "any" : pending.length} authorization events within ${timeoutMs} ms. Is the app running?`
      );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export const disconnect = () => prisma.$disconnect();

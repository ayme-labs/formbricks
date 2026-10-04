import { Metadata } from "next";
import React from "react";
import { NoScriptWarning } from "@/app/components/NoScriptWarning";
import { AymeLab } from "@/ayme/AymeLab";
import { labEnv } from "@/ayme/lab-env";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { SentryClientConfigScript } from "@/lib/sentry/SentryClientConfigScript";
import { I18nProvider } from "@/lingodotdev/client";
import { getLocale } from "@/lingodotdev/language";
import { StaleDeploymentPrompt } from "@/modules/ui/components/stale-deployment-prompt";
import "../modules/ui/globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Formbricks",
    default: "Formbricks",
  },
  description: "Open-Source Survey Suite",
};

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const locale = await getLocale();

  return (
    <html lang={locale} translate="no">
      <body className="flex h-dvh flex-col transition-all ease-in-out">
        {/* First in the document so instrumentation-client.ts can start Sentry as early as possible. */}
        <SentryClientConfigScript />
        <NoScriptWarning locale={locale} />
        <I18nProvider language={locale} defaultLanguage={DEFAULT_LOCALE}>
          <StaleDeploymentPrompt />
          {/* Ayme lab mode is on when the Ayme lab's lab:dev starts the app. */}
          <AymeLab labMode={labEnv().labMode}>{children}</AymeLab>
        </I18nProvider>
      </body>
    </html>
  );
};

export default RootLayout;

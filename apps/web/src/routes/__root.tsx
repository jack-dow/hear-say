import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ToastProvider } from "@/components/ui/toast";
import { env } from "@/lib/env";

const convex = new ConvexReactClient(env.VITE_CONVEX_URL);

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HearSay" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/static/favicons/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/static/favicons/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { rel: "apple-touch-icon", href: "/static/favicons/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

const THEME_SCRIPT = `(function(){var t=localStorage.getItem('pref:theme')||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark');})();`;

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Page not found.</p>
      <Link to="/" className="text-sm underline-offset-4 hover:underline">
        Go home
      </Link>
    </main>
  );
}

function RootComponent() {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>

      <body className="min-h-screen bg-background antialiased">
        <ConvexAuthProvider client={convex}>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </ConvexAuthProvider>

        <Scripts />
      </body>
    </html>
  );
}

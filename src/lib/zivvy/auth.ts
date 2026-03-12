import { chromium, type Cookie } from "playwright";

const ZIVVY_APP_URL = "https://app.addmembers.com";

/**
 * Authenticate with Zivvy via Playwright (OIDC flow through IdentityServer4).
 * Returns the AUTHCOOKIE value needed for API calls.
 *
 * The IDS login page is an AngularJS app with quirks:
 * - #username is a hidden field; #username2 is the visible email input
 * - #password is the visible password input
 * - ToS checkbox is hidden/custom-styled, must be set via JS + Angular scope
 * - page.fill() bypasses Angular's digest cycle; must use page.type() instead
 * - Button is ng-disabled until model.username2, model.password, and tosCheckbox are all truthy
 */
export async function getZivvyAuthCookie(): Promise<string> {
  const email = process.env.ZIVVY_EMAIL;
  const password = process.env.ZIVVY_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ZIVVY_EMAIL and ZIVVY_PASSWORD must be set in environment variables"
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    const page = await context.newPage();

    // Navigate to Zivvy app — will redirect to IDS login
    await page.goto(ZIVVY_APP_URL, { waitUntil: "networkidle" });

    // Wait for the visible email field
    await page.waitForSelector("#username2", { timeout: 15000 });

    // Use page.type() (not fill) to fire key events that trigger AngularJS model updates
    await page.click("#username2");
    await page.type("#username2", email, { delay: 10 });

    await page.click("#password");
    await page.type("#password", password, { delay: 10 });

    // Check ToS checkbox — it's hidden/custom-styled, so set via JS + Angular scope
    await page.evaluate(() => {
      const cb = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (cb) {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
        cb.dispatchEvent(new Event("click", { bubbles: true }));
      }
      // Set Angular scope directly as well
      try {
        const scope = (window as any).angular.element(document.querySelector("form")).scope();
        scope.tosCheckbox = true;
        scope.$apply();
      } catch (_) {}
    });

    // Brief wait for Angular digest cycle to enable the button
    await page.waitForTimeout(500);

    // Click sign-in
    await page.click(".sign-in-button");

    // Wait for redirect away from IDS login page
    await page.waitForURL(
      (url) => !url.toString().includes("ids.addmembers.com/login"),
      { timeout: 30000 }
    );

    // Extract session cookies from the browser context
    // Zivvy uses .AspNet.Cookies (+ C1, C2 for chunked large cookies) for auth
    const cookies: Cookie[] = await context.cookies(ZIVVY_APP_URL);
    const sessionCookies = cookies.filter(
      (c) =>
        c.name === ".AUTHCOOKIE" ||
        c.name === "AUTHCOOKIE" ||
        c.name.startsWith(".AspNet.Cookies")
    );

    if (sessionCookies.length === 0) {
      const cookieNames = cookies.map((c) => c.name).join(", ");
      throw new Error(
        `No auth cookies found after login. Available cookies: ${cookieNames}`
      );
    }

    // Return as a full cookie header string (name=value pairs joined by "; ")
    return sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } finally {
    await browser.close();
  }
}

/** Cookie cache to avoid re-authenticating on every API call */
let cachedCookie: { value: string; expiresAt: number } | null = null;

/**
 * Get a valid auth cookie, using cache if available.
 * Cache expires after 20 minutes (OIDC sessions typically last 30-60 min).
 */
export async function getCachedAuthCookie(): Promise<string> {
  const now = Date.now();
  if (cachedCookie && cachedCookie.expiresAt > now) {
    return cachedCookie.value;
  }

  const cookie = await getZivvyAuthCookie();
  cachedCookie = {
    value: cookie,
    expiresAt: now + 20 * 60 * 1000, // 20 minutes
  };

  return cookie;
}

/** Clear the cached cookie (e.g., on auth failure) */
export function clearAuthCache() {
  cachedCookie = null;
}

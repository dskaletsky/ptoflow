import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /auth/* (sign-in page)
     * - /api/auth/* (NextAuth.js API routes)
     * - /_next/* (Next.js internal assets)
     * - static files
     */
    "/((?!auth/|api/auth/|api/slack/|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};

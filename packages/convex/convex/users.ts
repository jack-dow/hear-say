import { getAuthUserId } from "@convex-dev/auth/server";

import { zQuery } from "./utils/builders";

// Used by the Python API to validate Convex auth tokens — returns null if unauthenticated
export const me = zQuery({
  args: {},
  handler: async (ctx) => {
    return getAuthUserId(ctx);
  },
});

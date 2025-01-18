/** We have to tell typescript this is a module, otherwise it will treat this file as a script in global scope,
 * In that case, the imports from @tanstack/react-router will give no exported member error, you can remove the import statement and see
 * So we can fix this by making this types.d.ts file a module, and three approaches to do that are
 * 1. Use export {}; even though its an empty export that makes it a module
 * 2. Use import like below, since anyways we are typing router to router we can do this
 * 3. use /// <references types=@tanstack/router> older approach not being user in modern typescript
 **/
import type { router } from "./router";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

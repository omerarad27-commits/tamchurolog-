/** Installs the "@/" resolver. Loaded with --import by the verify:* scripts. */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts-alias-hooks.mjs", pathToFileURL("./scripts/"));

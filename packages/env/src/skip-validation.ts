/**
 * `!!process.env.X` è vero anche per "false" e "0": la validazione dell'env si
 * sarebbe disattivata proprio nei casi in cui qualcuno voleva tenerla accesa.
 * Riconosciamo solo i valori che significano davvero "sì".
 */
const TRUTHY = new Set(["1", "true", "yes", "on"]);

export const skipEnvValidation = TRUTHY.has(
  (process.env.SKIP_ENV_VALIDATION ?? "").trim().toLowerCase(),
);

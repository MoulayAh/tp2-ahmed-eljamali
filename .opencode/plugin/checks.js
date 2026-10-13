// Checks post-ecriture : des qu'un agent ecrit un fichier .ts, on relance
// typecheck + lint + tests et on colle la sortie dans le resultat de l'outil,
// pour que l'agent voie le rouge sans qu'on ait a le lui demander.
//
// (INFRA-231 : le script scripts/checks.sh ne doit pas interrompre l'agent,
// il l'avertit, c'est a lui de corriger. Le verrou bloquant est le pre-commit + la CI.)
const WRITE_TOOLS = new Set(["edit", "write", "multiedit", "patch", "apply_patch"])

export const ChecksPlugin = async ({ $, directory }) => {
  return {
    "tool.execute.after": async (input, output) => {
      if (!WRITE_TOOLS.has(input.tool)) return
      // edit/write portent filePath ; les outils de patch portent le diff complet.
      const touched = JSON.stringify(input.args ?? {})
      if (!/\.ts\b/.test(touched)) return

      const res = await $`bash scripts/checks.sh`.cwd(directory).quiet().nothrow()
      output.output += "\n\n--- checks post-ecriture ---\n" + res.stdout.toString()
    },
  }
}

import { PluginKey, Plugin, EditorState, Transaction } from "prosemirror-state"
import { DocHandle } from "automerge-repo"
import { patchToProsemirrorTransaction, prosemirrorTransactionToAutomerge } from "./prosemirrorToAutomerge"
import * as Automerge from "@automerge/automerge"
export const automergePluginKey = new PluginKey(
  "automergeProsemirror"
)

export const automergePlugin = <T>(
  handle: DocHandle<T>,
  attribute: keyof T
) => {
  const changeDoc = handle.change.bind(handle)
  const plugin = new Plugin({
    key: automergePluginKey,
    state: {
      init(config, instance) {
        return { heads: [] }
      },
      apply(tr, value, oldState) {
        const meta = tr.getMeta(automergePluginKey)
        if (meta) {
          return { heads: meta.heads }
        }

        prosemirrorTransactionToAutomerge(
          tr.steps,
          changeDoc,
          attribute,
          oldState
        )

        return { heads: Automerge.getBackend(handle.doc).getHeads() }
      },
    },
  })

  return plugin
}

export function convertPatchToProsemirrorTransaction(tr: Transaction, patches: Patch[]): Transaction {
  const steps = patchToProsemirrorTransaction(patches)
  steps.map(s => tr.step(s))
  return tr
}
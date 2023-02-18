import { PluginKey, Plugin, EditorState } from "prosemirror-state"
import { DocHandle } from "automerge-repo"
import { prosemirrorTransactionToAutomerge } from "./prosemirrorToAutomerge"
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
      init(config, instance) { },
      apply(tr, value, oldState) {
        prosemirrorTransactionToAutomerge(
          tr.steps,
          changeDoc,
          attribute,
          oldState
        )
        return { }
      },
    },
  })

  return plugin
}

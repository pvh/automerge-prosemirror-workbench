import React, { useEffect, useRef } from "react"

import { Command, EditorState, Transaction } from "prosemirror-state"
import { keymap } from "prosemirror-keymap"
import { baseKeymap, toggleMark } from "prosemirror-commands"
import { history, redo, undo } from "prosemirror-history"
import { schema } from "prosemirror-schema-basic"
import { MarkType } from "prosemirror-model"
import { EditorView } from "prosemirror-view"
import { DocHandle, DocHandlePatchPayload } from "automerge-repo"
import { automergePlugin } from "./automerge-prosemirror"

import { Text } from "@automerge/automerge"
import { patchToProsemirrorTransaction } from "./prosemirrorToAutomerge"

export type EditorProps<T> = {
  handle: DocHandle<T>
  attribute: keyof T
}

const toggleBold = toggleMarkCommand(schema.marks.strong)
const toggleItalic = toggleMarkCommand(schema.marks.em)

function toggleMarkCommand(mark: MarkType): Command {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => {
    return toggleMark(mark)(state, dispatch)
  }
}

export function Editor<T>({ handle, attribute }: EditorProps<T>) {
  const editorRoot = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    let editorConfig = {
      schema,
      history,
      plugins: [
        automergePlugin(handle, attribute),
        keymap({
          ...baseKeymap,
          "Mod-b": toggleBold,
          "Mod-i": toggleItalic,
          "Mod-z": undo,
          "Mod-y": redo,
          "Mod-Shift-z": redo,
        }),
      ],
    }      

    let state = EditorState.create(editorConfig)
    const view = new EditorView(editorRoot.current, { state })

    handle.value().then((doc) => {
      if (view.isDestroyed) {
        return // too late
      }

      if (!doc.text) {
        console.log("initializing text")
        handle.change(d => {d.text = new Text("")})
      }
    })

    const onPatch = (arg: DocHandlePatchPayload<T>) => {
      try {
      console.log("patch", arg)
      let tr = view.state.tr
      const steps = patchToProsemirrorTransaction(arg.patches)
      console.log(steps)
      steps.map(s => tr.step(s))
      
      view.updateState(view.state.apply(tr)) 
      } catch (e) { console.log(e); debugger }
    }
    handle.on("patch", onPatch)

    // move this out, we're in a then
    return () => {
      // console.log("cleaning up")
      handle.off("patch", onPatch)
      view.destroy()
    }
  }, [handle, attribute])
  

  return <div ref={editorRoot}></div>
}

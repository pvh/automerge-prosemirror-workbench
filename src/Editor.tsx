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

import { DOMParser as ProseDOMParser } from "prosemirror-model"

import { Text } from "@automerge/automerge"

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
    handle.value().then((doc) => {
      var dom = new DOMParser().parseFromString(handle.doc.text, "text/html");

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
        doc: ProseDOMParser.fromSchema(schema).parse(dom),
      }      

      let state = EditorState.create(editorConfig)
      const view = new EditorView(editorRoot.current, { state })

      if (view.isDestroyed) {
        return // too late
      }

      if (!doc.text) {
        console.log("initializing text")
        handle.change(d => {d.text = new Text("\n")})
      }

      /*const transaction = createProsemirrorTransactionOnChange(
        view.state,
        attribute,
        doc
      )*/
      /* const transaction = view.state.tr
      transaction.insertText(doc[attribute])
      view.updateState(view.state.apply(transaction)) */
    })

    /* const onPatch = (args: DocHandlePatchEvent<T>) => {
      const transaction = createProsemirrorTransactionOnChange(
        view.state,
        attribute,
        args.handle.doc
      )
      view.updateState(view.state.apply(transaction))
    }
    handle.on("change", onChange)
    */ 
    // move this out, we're in a then
    return () => {
      // console.log("cleaning up")
      // handle.off("change", onChange)
      // view.destroy()
    }
  }, [handle, attribute])
  

  return <div ref={editorRoot}></div>
}

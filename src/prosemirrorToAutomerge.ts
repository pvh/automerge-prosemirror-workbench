
import { Doc, Text, Patch, ChangeFn, ChangeOptions, Extend, PutPatch, InsertPatch } from "@automerge/automerge"
import { unstable as AutomergeUnstable } from "@automerge/automerge"
import { EditorState } from "prosemirror-state"
import { schema } from "prosemirror-schema-basic"
import { Fragment, Slice } from "prosemirror-model"

import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceAroundStep,
  ReplaceStep,
  Step,
} from "prosemirror-transform"
import { Value } from "@automerge/automerge-wasm"

function prosemirrorPositionToAutomergePosition(
  position: number,
): number {

  return position - 1
}

function handleReplaceStep<T>(
  step: ReplaceStep,
  doc: Doc<T>,
  attribute: keyof T,
  state: EditorState
): void {
  console.log(step)
  const { from, to, slice } = step
  
  const start = prosemirrorPositionToAutomergePosition(from)
  const count = prosemirrorPositionToAutomergePosition(to) - prosemirrorPositionToAutomergePosition(from)
  const newText = (slice.content.childCount == 0) ? "" : slice.content.textBetween(0, slice.size)
  AutomergeUnstable.splice(doc, attribute as string, start, count, newText)

  console.log(doc.text.join(","))
}

export const prosemirrorTransactionToAutomerge = <T>(
  steps: Step[],
  changeDoc: (callback: ChangeFn<T>, options?: ChangeOptions<T> | undefined) => Promise<void>,
  attribute: keyof T,
  state: EditorState
) => {
  if (steps.length === 0) {
    return
  }
  console.log("inner", steps)
  // TODO: ugh on the types here.
  changeDoc((doc: Extend<T>) => {
    for (let step of steps) {
      console.log(step)
      if (step instanceof ReplaceStep) {
        handleReplaceStep(step, doc as Doc<T>, attribute, state)
      } else {
        console.log(step)
        throw new Error(
          "We encountered a Prosemirror transaction step type we can't handle."
        )
      }
    }
  })
}

function handlePutPatch(p: PutPatch): Step {
  throw new Error("Not implemented")
}

function patchContentToFragment(values: Value[]) {
  const text = values.join("")
  const BLOCK_MARKER = "\n"
  let blocks = text.split(BLOCK_MARKER)

  let depth = blocks.length > 1 ? 1 : 0

  // blocks: [ "text the first", "second text", "text" ]
  //          ^ no pgh break    ^ pgh break    ^ pgh break 2

  // the first text node here doesn't get a paragraph break
  // we should already have a paragraph that we're tacking this node onto
  
  /*
  let block = blocks.shift()
  if (!block) {
    let node = schema.node("paragraph", {}, [])
    nodes.push(node)
  } else {
    if (blocks.length === 0) {
      nodes.push(schema.text(block))
    } else {
      nodes.push(schema.node("paragraph", {}, schema.text(block)))
    }
  }
  */

  // get the head of the list
  // if it's an empty value, push in a new empty paragraph
  // ELSE
    // if there's no more blocks, just append this text
    // and if there are more blocks after this, put it into a new paragraph containing the text (!?)
  
  // NOW FOR THE REST
    // empty blocks just push in an empty paragraph
    // non-empty blocks push in a filled paragraph
    
  const nodes = blocks.map((block) => 
    schema.node("paragraph", {}, block.length ? schema.text(block) : [])
  )

  return Fragment.fromArray(nodes)
}

function handleInsertPatch(p: InsertPatch): Step {

  const depth = 0
  const from = p.path[p.path.length - 1] as number // uhhhh... maybe.

  const fragment = patchContentToFragment(p.values)

  return new ReplaceStep(from, from, new Slice(fragment, depth, depth))
}

export function patchToProsemirrorTransaction(patches: Patch[]): Step[] {
  // we filter out put patches that recreate the entire document
  return patches.filter(p => p.action !== "put").map((p) => {
    console.log('applying', p)
    switch(p.action) {
      case "put":
        return handlePutPatch(p)
        break
      case "insert": 
        return handleInsertPatch(p)
        break
      default:
        throw new Error("We encountered a Prosemirror transaction step type we can't handle.")
    }
  })
}
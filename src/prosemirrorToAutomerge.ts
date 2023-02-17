
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
  /* let nodes = []
  
  const depth = 0
  const content = p.value as string
  const from = p.path[-1] as number // uhhhh... maybe.
  nodes.push(schema.text(content))

  let fragment = Fragment.fromArray(nodes)
  let slice = new Slice(fragment, depth, depth)
  return new ReplaceStep(from, from, slice)
  */
}

function handleInsertPatch(p: InsertPatch): Step {
  let nodes = []
  
  const depth = 0
  const content = p.values.join("")
  const from = p.path[p.path.length - 1] as number // uhhhh... maybe.
  nodes.push(schema.text(content))

  let fragment = Fragment.fromArray(nodes)
  let slice = new Slice(fragment, depth, depth)
  return new ReplaceStep(from, from, slice)
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

import { Doc, Text, Patch, ChangeFn, ChangeOptions, Extend, PutPatch, InsertPatch, DelPatch } from "@automerge/automerge"
import { unstable as AutomergeUnstable } from "@automerge/automerge"
import { EditorState, Transaction } from "prosemirror-state"
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

// How to handle a complex replace with multiple inserts?
// Prosemirror wants to send us a structured fragment with a from/to
// I guess as long as we're in a single change block we'll only get one patch at the end
// So we can do a delete?
// Probably the principled thing to do would be to walk the Fragment,
// build up a single splice, tracking marks alongside as we go, then commit the whole shebang with a single splice
// followed by some .mark and .unmark calls

function handleReplaceStep<T>(
  step: ReplaceStep,
  doc: Extend<T>,
  attribute: keyof T,
  state: EditorState
): void {
  console.log(step)
  const { from, to, slice } = step
  
  const length = to - from
  let pos = step.from - 1

  const node = slice.content.firstChild
  
  // Just deleting.
  if (!node) {
    AutomergeUnstable.splice(doc, attribute as string, pos, length, "")
  }

  // Inserting plaintext.
  else if (node.isText) {
    const newText = node.text
    const count = node.nodeSize
    AutomergeUnstable.splice(doc, attribute as string, pos, length, newText)
    pos += count
  }

  // Inserting a paragraph break
  else if (node.type.name === "paragraph") {
    const string = ""
    slice.content.forEach( p => {
      const string = p.textContent + "\n\n"
      AutomergeUnstable.splice(doc, attribute, pos, length, string)
    })
  }

  else {
    console.log(node)
    debugger
  }

  console.log("Automerge after this: ", doc.text.join(","))
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
        handleReplaceStep(step, doc as Extend<T>, attribute, state)
      } else {
        console.log(step)
        debugger
        throw new Error(
          "We encountered an Automerge step type we can't handle."
        )
      }
    }
  })
}

function handlePutPatch(p: PutPatch): Step {
  throw new Error("Not implemented")
}

/* const text = p.values.join("")
  const BLOCK_MARKER = "\n"
  const blocks = text.split(BLOCK_MARKER)

  const depth = blocks.length > 1 ? 1 : 0
  const from = p.path[p.path.length - 1] as number // uhhhh... maybe.

  // blocks: [ "text the first", "second text", "text" ]
  //          ^ no pgh break    ^ pgh break    ^ pgh break 2

  // the first text node here doesn't get a paragraph break
  // we should already have a paragraph that we're tacking this node onto
  const nodes = []  

  nodes.push(schema.node("paragraph", {}, []))

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

  blocks.forEach((block) => {
    // FIXME this might be wrong for e.g. a paste with multiple empty paragraphs
    if (block.length === 0) {
      nodes.push(schema.node("paragraph", {}, []))
      return
    } else {
      let node = schema.node("paragraph", {}, schema.text(block))
      nodes.push(node)
    }
*/

function handleInsertPatch(patch: InsertPatch): Step | undefined {
  console.log("insertpatch", patch)
  
  if (patch.path[0] !== "text") { 
    return
  }
  const from = patch.path[1] as number

  const paragraphs = patch.values.join('').split('\n\n')
  const nodes = paragraphs.map(t => schema.node("paragraph", null, t ? schema.text(t) : undefined))

  let depth = 1
  let fragment = Fragment.fromArray(nodes)
  let slice = new Slice(fragment, depth, depth)
  let step = new ReplaceStep(from+1, from+1, slice)

  console.log("insertstep", step)
  return step
}

function handleDelPatch(patch: DelPatch): Step | undefined {
  console.log("delpatch", patch)
  
  if (patch.path[0] !== "text") { 
    return
  }

  const from = patch.path[1] as number
  const to = from + (patch.length || 1) // !? orion, is this really right?

  let depth = 0
  let fragment = Fragment.empty
  let slice = new Slice(fragment, depth, depth)
  let step = new ReplaceStep(from+1, to+1, slice)

  console.log("delstep", step)
  return step
}

export function patchToProsemirrorTransaction(tr: Transaction, patches: Patch[]): Step[] {
  console.log(tr.doc)

  const steps = patches.filter(p => p.action !== "put").map((p) => {
    console.log('applying', p)
    switch(p.action) {
      case "put":
        return handlePutPatch(p)
        break
      case "insert": 
        return handleInsertPatch(p)
        break
      case "del":
        return handleDelPatch(p)
      default:
        throw new Error("We encountered a Prosemirror transaction step type we can't handle.")
    }
  }).filter(s => s !== undefined) as Step[]

  steps.map(s => tr.step(s))
  
  return steps
}
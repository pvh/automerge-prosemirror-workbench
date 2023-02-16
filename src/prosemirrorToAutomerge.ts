import { Doc, Text, Patch, ChangeFn, ChangeOptions, Extend } from "@automerge/automerge"
import { unstable as AutomergeUnstable } from "@automerge/automerge"
import { EditorState } from "prosemirror-state"
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
  const newText = (slice.content.childCount == 0) ? "" : slice.content.textBetween(0, 1)
  
  AutomergeUnstable.splice(doc, attribute as string, prosemirrorPositionToAutomergePosition(from), prosemirrorPositionToAutomergePosition(to), newText)
  console.log(doc.text.join(""))
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

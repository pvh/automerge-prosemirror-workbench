import { useDocument } from "automerge-repo-react-hooks"
import { DocumentId } from "automerge-repo"

interface Doc {
  count: number
}

export function App(props: { documentId: DocumentId }) {
  const [doc, changeDoc] = useDocument<Doc>(props.documentId)

  return (
    <button
      onClick={() => {
        changeDoc((d: any) => {
          d.count = (d.count || 0) + 1
        })
      }}
    >
      count is: {doc?.count ?? 0}
    </button>
  )
}

export default App

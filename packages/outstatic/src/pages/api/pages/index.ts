import { NextApiRequest, NextApiResponse } from 'next'
import { getLoginSession } from '../../../utils/auth/auth'
import { FileType, Session } from '../../../types'
import { createCommit as createCommitApi } from '../../../utils/createCommit'
import { IMAGES_PATH } from '../../../utils/constants'
import { assertUnreachable } from '../../../utils/assertUnreachable'
import { initializeApollo } from '../../../utils/apollo'
import {
  CreateCommitDocument,
  CreateCommitMutation,
  CreateCommitMutationVariables
} from '../../../graphql/generated'

export type UpsertPageType = {
  originalContent: string
  oid: any
  owner: string
  newSlug: string
  slug: string
  repoSlug: string
  repoBranch: string
  monorepoPath: string
  contentPath: string
  collection: string
  files: FileType[]
  replaceFiles: Record<string, string>
}

export async function postHandler(
  session: Session,
  req: NextApiRequest,
  res: NextApiResponse
) {
  const body = req.body as UpsertPageType

  const {
    originalContent,
    oid,
    owner,
    newSlug,
    slug,
    repoSlug,
    repoBranch,
    monorepoPath,
    contentPath,
    collection,
    files,
    replaceFiles
  } = body

  let content = originalContent

  console.log(body)

  // If the slug has changed, commit should delete old file
  const oldSlug = slug !== newSlug && slug !== 'new' ? slug : undefined

  const capi = createCommitApi({
    message: oldSlug
      ? `chore: Updates ${newSlug} formerly ${oldSlug}`
      : `chore: Updates/Creates ${newSlug}`,
    owner,
    oid: oid ?? '',
    name: repoSlug,
    branch: repoBranch
  })

  if (oldSlug) {
    capi.removeFile(
      `${
        monorepoPath ? monorepoPath + '/' : ''
      }${contentPath}/${collection}/${oldSlug}.md`
    )
  }

  if (files.length > 0) {
    files.forEach(({ filename, blob, type, content: fileContents }) => {
      // check if blob is still in the document before adding file to the commit
      if (blob && content.search(blob) !== -1) {
        const randString = window
          .btoa(Math.random().toString())
          .substring(10, 6)
        const newFilename = filename
          .toLowerCase()
          .replace(/[^a-zA-Z0-9-_\.]/g, '-')
          .replace(/(\.[^\.]*)?$/, `-${randString}$1`)

        const filePath = (() => {
          switch (type) {
            case 'images':
              return IMAGES_PATH
            default:
              assertUnreachable(type)
          }
        })()

        capi.replaceFile(
          `${
            monorepoPath ? monorepoPath + '/' : ''
          }public/${filePath}${newFilename}`,
          fileContents,
          false
        )

        // replace blob in content with path
        content = content.replace(blob, `/${filePath}${newFilename}`)
      }
    })
  }

  capi.replaceFile(
    `${
      monorepoPath ? monorepoPath + '/' : ''
    }${contentPath}/${collection}/${newSlug}.md`,
    content
  )

  for (let fileName in replaceFiles) {
    capi.replaceFile(fileName, replaceFiles[fileName])
  }

  const input = capi.createInput()

  const client = initializeApollo(null, session)

  await client.mutate<CreateCommitMutation, CreateCommitMutationVariables>({
    mutation: CreateCommitDocument,
    variables: {
      input
    }
  })

  res.status(200).send({ input })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getLoginSession(req)

  if (!session?.access_token) {
    res.status(401).end()
    return
  }

  switch (req.method) {
    case 'POST':
      return postHandler(session, req, res)
  }

  // If no handler return method not found error
  res.status(405).end()
}

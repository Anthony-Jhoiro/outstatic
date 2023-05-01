import fetch from 'cross-fetch'
import { UpsertPageType } from '../../../pages/api/pages'
import { MetadataSchema } from '../../metadata/types'
import { hashFromUrl } from '../../hashFromUrl'
import { DocumentQuery } from '../../../graphql/generated'
import MurmurHash3 from 'imurmurhash'
import { stringifyMetadata } from '../../metadata/stringify'
import { FileType } from '../../../types'
import { IMAGES_PATH } from '../../constants'
import { assertUnreachable } from '../../assertUnreachable'
import { v4 as uuidV4 } from 'uuid'
import { Base64 } from 'js-base64'

type UpsertPageTypeToRename = Omit<UpsertPageType, 'replaceFiles'> & {
  oldSlug: string | undefined
  metadata?: DocumentQuery
  matterData: { [p: string]: any }
  files: FileType[]
}

function handleFiles(
  files: FileType[],
  originalContent: string,
  monorepoPath: string
) {
  let content = originalContent
  const blobsToReplace = files
    // check if blob is still in the document before adding file to the commit
    .filter(({ blob }) => blob && content.search(blob) !== -1)
    .map(({ filename, blob, type, content: fileContents }) => {
      const randString = uuidV4()
      const newFilename = filename
        .toLowerCase()
        .replace(/[^a-zA-Z0-9-_.]/g, '-')
        .replace(/(\.[^.]*)?$/, `-${randString}$1`)

      const filePath = (() => {
        switch (type) {
          case 'images':
            return IMAGES_PATH
          default:
            assertUnreachable(type)
        }
      })()

      const newFilePath = `/${filePath}${newFilename}`

      return {
        file: `${monorepoPath ? monorepoPath + '/' : ''}public${newFilePath}`,
        content: Base64.encode(fileContents),
        blob: blob as string,
        newFilePath
      }
    })

  blobsToReplace.forEach(
    (file) => (content = content.replace(file.blob, file.newFilePath))
  )

  return {
    content,
    toReplace: blobsToReplace.reduce(
      (acc, blobToReplace) => ({
        ...acc,
        [blobToReplace.file]: blobToReplace.content
      }),
      {}
    )
  }
}

export const saveMetadata = ({
  collection,
  oldSlug,
  matterData,
  monorepoPath,
  contentPath,
  newSlug,
  originalContent,
  metadata
}: UpsertPageTypeToRename) => {
  if (metadata?.repository?.object?.__typename === 'Blob') {
    const m = JSON.parse(
      metadata.repository.object.text ?? '{}'
    ) as MetadataSchema
    m.generated = new Date().toISOString()
    m.commit = hashFromUrl(metadata.repository.object.commitUrl)
    ;(m.metadata ?? []).filter(
      (c) =>
        c.collection !== collection &&
        (c.slug !== oldSlug || c.slug !== newSlug)
    )
    const state = MurmurHash3(originalContent)
    m.metadata.push({
      ...matterData,
      title: matterData.title,
      publishedAt: matterData.publishedAt,
      status: matterData.published,
      slug: newSlug,
      collection,
      __outstatic: {
        hash: `${state.result()}`,
        commit: m.commit,
        path: `${contentPath}/${collection}/${newSlug}.md`
      }
    })

    return {
      [`${monorepoPath ? monorepoPath + '/' : ''}${contentPath}/metadata.json`]:
        stringifyMetadata(m)
    }
  }
  return {}
}

export function upsertPage(pageInfo: UpsertPageTypeToRename) {
  const metadataReplacements = saveMetadata(pageInfo)

  const { content, toReplace } = handleFiles(
    pageInfo.files,
    pageInfo.originalContent,
    pageInfo.monorepoPath
  )

  const body: UpsertPageType = {
    originalContent: content,
    oid: pageInfo.oid,
    owner: pageInfo.owner,
    newSlug: pageInfo.newSlug,
    slug: pageInfo.slug,
    repoSlug: pageInfo.repoSlug,
    repoBranch: pageInfo.repoBranch,
    monorepoPath: pageInfo.monorepoPath,
    contentPath: pageInfo.contentPath,
    collection: pageInfo.collection,
    replaceFiles: {
      ...toReplace,
      ...metadataReplacements
    }
  }

  return fetch('/api/outstatic/pages', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

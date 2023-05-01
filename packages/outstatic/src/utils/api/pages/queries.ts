import fetch from 'cross-fetch'
import { UpsertPageType } from '../../../pages/api/pages'
import { MetadataSchema } from '../../metadata/types'
import { hashFromUrl } from '../../hashFromUrl'
import { DocumentQuery } from '../../../graphql/generated'
import MurmurHash3 from 'imurmurhash'
import { stringifyMetadata } from '../../metadata/stringify'

type UpsertPageTypeToRename = Omit<UpsertPageType, 'replaceFiles'> & {
  oldSlug: string | undefined
  metadata?: DocumentQuery
  matterData: { [p: string]: any }
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
  const filesToReplace = saveMetadata(pageInfo)

  const body: UpsertPageType = {
    originalContent: pageInfo.originalContent,
    oid: pageInfo.oid,
    owner: pageInfo.owner,
    newSlug: pageInfo.newSlug,
    slug: pageInfo.slug,
    repoSlug: pageInfo.repoSlug,
    repoBranch: pageInfo.repoBranch,
    monorepoPath: pageInfo.monorepoPath,
    contentPath: pageInfo.contentPath,
    collection: pageInfo.collection,
    files: pageInfo.files,
    replaceFiles: filesToReplace
  }

  return fetch('/api/outstatic/pages', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

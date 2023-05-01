import { useMutation, UseMutationOptions } from '@tanstack/react-query'
import { upsertPage } from './queries'

const PAGE_QUERY_KEY = 'page'

export const useUpsertPage = (
  options?: UseMutationOptions<any, any, Parameters<typeof upsertPage>[0]>
) => useMutation([PAGE_QUERY_KEY], upsertPage, options)

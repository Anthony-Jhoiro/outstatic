import { NextApiRequest, NextApiResponse } from 'next'
import { Session } from 'next-session/lib/types'
import callback from './auth/callback'
import login from './auth/login'
import signout from './auth/signout'
import user from './auth/user'
import images from './images'
import pages from './pages'

interface Request extends NextApiRequest {
  session: Session
}

type QueryType = { ost: ['callback', 'login', 'signout', 'user', 'images'] }

const apiRoutes = {
  callback,
  login,
  signout,
  user,
  images,
  pages
}

export const OutstaticApi = (req: Request, res: NextApiResponse) => {
  const { ost } = req.query as QueryType

  return apiRoutes[ost[0]](req, res)
}

export const OutstaticApiConfig = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
}

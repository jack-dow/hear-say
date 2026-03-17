import { httpRouter } from 'convex/server'

import { auth } from './auth'

const http = httpRouter()

// Required for @convex-dev/auth token exchange
auth.addHttpRoutes(http)

export default http

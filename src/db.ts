import { createConnection } from 'typeorm'
import { CustomNamingStrategy } from './customNamingStrategy'

import User from './entities/User'
import SavedOrder from './entities/SavedOrder'
import TradeBotEntity from './entities/TradeBotEntity'
import ScoresWeightsEntityV1 from './entities/ScoresWeightsEntityV1'
import PairWeightsEntityV1 from './entities/PairWeightsEntityV1'

const db = () =>
  createConnection({
    entities: [
      User,
      SavedOrder,
      TradeBotEntity,
      ScoresWeightsEntityV1,
      PairWeightsEntityV1,
    ],
    logging: false,
    namingStrategy: new CustomNamingStrategy(),
    synchronize: true,
    type: 'postgres',
    url: process.env.DATABASE_URL || 'postgres://postgres:secret@localhost:5432/postgres'
  })
  .then(() => console!.log('Connected to Postgres with TypeORM'));

export default db
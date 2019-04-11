import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm'
import { snakeCase } from 'typeorm/util/StringUtils'

export class CustomNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {

  public tableName(targetName: string, userSpecifiedName: string): string {
    return userSpecifiedName ? userSpecifiedName : snakeCase(targetName) + 's'
  }

  public columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    return snakeCase(embeddedPrefixes.concat(customName ? customName : propertyName).join('_'))
  }

  public columnNameCustomized(customName: string): string {
    return customName
  }

  public relationName(propertyName: string): string {
    return snakeCase(propertyName)
  }
}
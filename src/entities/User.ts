import * as bcrypt from 'bcrypt'
import { Exclude } from 'class-transformer'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { BaseEntity } from 'typeorm/repository/BaseEntity'

@Entity()
class User extends BaseEntity {

  @PrimaryGeneratedColumn()
  public id: number

  @Column('text', { nullable: false })
  public firstName: string

  @Column('text', { nullable: false })
  public lastName: string

  public fullName = (): string => `${this.firstName} ${this.lastName}`

  @Column('text', { nullable: false })
  public email: string

  @Column('text', { nullable: true })
  public binanceKey: string

  @Column('text', { nullable: true })
  public binanceSecret: string

  @Column('bool', { nullable: true })
  public autoTrading: boolean

  @Column('text', { nullable: true })
  @Exclude({ toPlainOnly: true })
  public password: string

  public async setPassword(rawPassword: string) {
    this.password = await bcrypt.hash(rawPassword, 10)
  }

  public checkPassword(rawPassword: string): Promise<boolean> {
    return bcrypt.compare(rawPassword, this.password)
  }
}

export default User
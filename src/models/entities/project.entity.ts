import {
  AllowNull,
  AutoCreateNUpdate,
  AutoIncrement,
  BigInt,
  Bool,
  Entity,
  Id,
  LongText,
  ManyToOne,
  PrimaryKey,
  Table,
  Varchar,
} from '@smallprod/models';

import { Context } from '@smallprod/models/dist/entities/entitymanager';
import ProjectCategoryEntity from './projectcategory.entity';
import UserEntity from './user.entity';

@Table('project')
@AutoCreateNUpdate()
export default class ProjectEntity extends Entity {
  @Id()
  @PrimaryKey()
  @AutoIncrement()
  @BigInt()
  public id: number;

  @Varchar(50)
  public name: string;

  @ManyToOne('user', true)
  public author: UserEntity;

  @LongText()
  public description: string;

  @Varchar(50)
  public picture: string;

  @Varchar(255)
  @AllowNull()
  public designLink: string;

  @LongText()
  public rules: string;

  @ManyToOne('projectcategory', true)
  public category: ProjectCategoryEntity;

  @Bool()
  public isPublished = false;

  constructor(
    name: string,
    description: string,
    picture: string,
    designLink: string,
    author: UserEntity,
    category: ProjectCategoryEntity,
    rules: string,
  ) {
    super();
    this.name = name;
    this.description = description;
    this.picture = picture;
    this.designLink = designLink;
    this.author = author;
    this.category = category;
    this.rules = rules;
  }
}

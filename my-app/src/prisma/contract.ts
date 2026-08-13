import { defineContract } from '@prisma/orm-postgres/contract-builder';

export const contract = defineContract(
  {},
  ({ field, model, rel }) => ({
    models: {
      User: model('User', {
        fields: {
          id: field.id.uuidv7String(),
          email: field.text().unique(),
          username: field.text().optional(),
          name: field.text().optional(),
          createdAt: field.temporal.createdAt(),
          updatedAt: field.temporal.updatedAt(),
        },
        relations: {
          posts: rel.hasMany('Post', { by: 'authorId' }),
        },
      }),

      Post: model('Post', {
        fields: {
          id: field.id.uuidv7String(),
          title: field.text(),
          content: field.text().optional(),
          authorId: field.uuidString(),
          createdAt: field.temporal.createdAt(),
          updatedAt: field.temporal.updatedAt(),
        },
        relations: {
          author: rel.belongsTo('User', { from: 'authorId', to: 'id' }),
        },
      }),
    },
  }),
);

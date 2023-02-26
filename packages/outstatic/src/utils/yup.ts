import * as yup from 'yup'
import { buildYup } from 'schema-to-yup'
import { CustomFields, SchemaShape } from '../types'

const documentShape = {
  title: yup.string().required('Title is required.'),
  publishedAt: yup.date().required('Date is required.'),
  content: yup.string().required('Content is required.'),
  status: yup
    .string()
    .equals(['published', 'draft'])
    .required('Status is missing.'),
  author: yup.object().shape({
    name: yup.string(),
    picture: yup.string()
  }),
  slug: yup
    .string()
    .matches(/^(?!new$)/, 'The word "new" is not a valid slug.')
    .matches(
      /^[a-z0-9-]+$/,
      'Slugs can only contain lowercase letters, numbers and dashes.'
    )
    .matches(
      /^[a-z](-?[a-z])*$/,
      'Slugs can only start and end with a letter and cannot contain two dashes in a row.'
    )
    .required(),
  description: yup.string(),
  coverImage: yup.string()
}

export const editDocumentSchema: yup.SchemaOf<SchemaShape> = yup
  .object()
  .shape(documentShape)

export const convertSchemaToYup = (customFields: {
  properties: CustomFields
}) => {
  const shape: SchemaShape = {}

  Object.entries(customFields.properties).map(([name, fields]) => {
    // Yup doesn't support text fields, so we convert them to string
    const fieldType = fields.type === 'text' ? 'string' : fields.type
    shape[name] = { ...customFields.properties[name], type: fieldType }
  })

  const yupSchema = buildYup({
    type: 'object',
    properties: { ...documentShape, ...shape }
  })
  return yupSchema
}

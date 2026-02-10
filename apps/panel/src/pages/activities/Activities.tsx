/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from 'react'
import SpicaTable from '../../components/organisms/table/Table'
import type { TableColumn } from 'oziko-ui-kit'

interface Activity {
  _id: string
  identifier: string
  email: string
}

const Activities = () => {
  const columns: TableColumn<Activity>[] = [
    {
      key: '_id',
      title: 'ID',
      render: (item) => item._id,
    },
    {
      key: 'identifier',
      title: 'Identifier',
      render: (item) => item.identifier,
    },
    {
      key: 'email',
      title: 'Email',
      render: (item) => item.email,
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (item) => (
        <div>
          {/* Add your action buttons here */}
        </div>
      ),
    },
  ]

  const data: Activity[] = []

  return (
    <SpicaTable columns={columns} data={data} />
  )
}

export default Activities
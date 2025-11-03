import React, { useEffect } from 'react'
import { useGetBucketsQuery } from '../store/api/bucketApi';
import BucketNode from './diagram/components/organisms/node-view/BucketNode';

const BucketPage = () => {

    const { data: buckets = [], refetch: getBuckets } = useGetBucketsQuery();

    useEffect(() => {
        getBuckets();
    }, [getBuckets]);

  return (
    <div>
        <h1>Buckets</h1>
        <ul>
            {buckets.map((bucket) => (
                <BucketNode key={bucket._id} bucket={bucket} />
            ))}
        </ul>
    </div>
  )
}

export default BucketPage
import styles from "./Bucket.module.scss";
import {useBucket} from "../../contexts/BucketContext";
import {useEffect} from "react";
import {useParams} from "react-router-dom";

export default function Bucket() {
  const {bucketId} = useParams<{bucketId: string}>();

  const {currentBucket, currentBucketLoading, currentBucketError, getCurrentBucket} = useBucket();

  useEffect(() => {
    if (!bucketId) return;
    getCurrentBucket(bucketId);
  }, [bucketId]);

  return (
    <div>
      <h1>Bucket Page</h1>
      <p>This is the bucket page content.</p>
      <p>Bucket Id: {bucketId}</p>
      <p>Data: {JSON.stringify(currentBucket)}</p>
      <p>Loading: {currentBucketLoading ? "yes" : "no"}</p>
      <p>Error: {currentBucketError ?? "Everything is okay"}</p>
    </div>
  );
}

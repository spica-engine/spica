import useApi from "../../hooks/useApi";
import styles from "./Bucket.module.scss";
import {useParams} from "react-router-dom";
import {useEffect} from "react";

export function Bucket() {
  const {bucketId} = useParams<{bucketId: string}>();
  const {request, data} = useApi({
    endpoint: `/api/bucket/${bucketId}/data?paginate=true&relation=true&limit=25&sort={"_id": -1}`
  });

  useEffect(() => {
    if (!bucketId) return;
    request();
  }, [bucketId]);

  return (
    <div>
      <h1>Bucket Page</h1>
      <p>This is the bucket page content.</p>
      <p>Bucket ID: {bucketId}</p>
      <p>Data: {JSON.stringify(data)}</p>
    </div>
  );
}

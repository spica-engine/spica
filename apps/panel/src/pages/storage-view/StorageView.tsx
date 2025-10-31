import {useParams} from "react-router";
import useFileView from "../../hooks/useFileView";
import {useGetStorageItemQuery} from "../../store/api";
import useStorage from "../../hooks/useStorage";

export default function StorageView() {
  const {storageId} = useParams<{storageId: string}>();
  const {data: storageData} = useGetStorageItemQuery(storageId!);
  const {convertStorageToTypeFile} = useStorage();
  const storage = storageData ? convertStorageToTypeFile(storageData) : null;
  const fullWidth = {maxWidth: "100vw", width: "100%"};
  const fullHeight = {height: "100vh"};
  const fileView = useFileView({
    file: storage || undefined,
    styles: {
      image: fullWidth,
      video: fullWidth,
      text: {...fullWidth, ...fullHeight},
      doc: fullWidth,
      pdf: {...fullWidth, ...fullHeight}
    }
  });
  return fileView;
}

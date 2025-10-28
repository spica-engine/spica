import {Icon, Spinner, type TypeFile} from "oziko-ui-kit";
import type {CSSProperties} from "react";
import {useSelector} from "react-redux";
import {AuthorizedEmbed} from "../components/atoms/authorized-embed/AuthorizedEmbed";
import {AuthorizedVideo} from "../components/atoms/authorized-video/AuthorizedVideoProps";
import {AuthorizedImage} from "../components/atoms/authorized-image/AuthorizedImage";
import {AuthorizedText} from "../components/atoms/authorized-text/AuthorizedText";
import {WordDocViewer} from "../components/atoms/word-doc-viewer/WordDocViewer";
import {selectToken} from "../store";

type TypeStyle = {
  image?: CSSProperties;
  video?: CSSProperties;
  text?: CSSProperties;
  doc?: CSSProperties;
  pdf?: CSSProperties;
};

type TypeClassName = {
  image?: string;
  video?: string;
  text?: string;
  doc?: string;
  spreadsheet?: string;
  pdf?: string;
  zip?: string;
};

type TypeUseFileView = {
  file?: TypeFile;
  styles?: TypeStyle;
  classNames?: TypeClassName;
  isLoading?: boolean;
};

const useFileView = ({file, styles, classNames, isLoading}: TypeUseFileView) => {
  const token = useSelector(selectToken);

  if (!file) {
    return null;
  }

  const contentTypeMapping = [
    {
      regex: /^image\//,
      viewer: (file: TypeFile, isLoading: boolean) => (
        <AuthorizedImage
          token={token || undefined}
          key={file.url}
          file={file}
          isLoading={isLoading}
        />
      )
    },
    {
      regex: /^video\//,
      viewer: (file: TypeFile) => (
        <AuthorizedVideo
          type={file.content.type}
          url={file.url}
          token={token || ""}
          style={styles?.video}
          className={classNames?.video}
        />
      )
    },
    {
      regex: /^(text\/plain|text\/javascript|application\/json)$/,
      viewer: (file: TypeFile, isLoading: boolean) => (
        <AuthorizedText
          fileUrl={file.url}
          token={token || ""}
          style={styles?.text}
          className={classNames?.text}
          isLoading={isLoading}
        />
      )
    },
    {
      regex:
        /^(application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document)$/,
      viewer: (file: TypeFile) => <WordDocViewer url={file.url} className={classNames?.doc} style={styles?.doc} />
    },
    {
      regex: /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/csv)$/,
      viewer: () => <Icon name="gridOn" size={72} className={classNames?.spreadsheet} />
    },
    {
      regex: /^application\/pdf/,
      viewer: (file: TypeFile) => {
        const url = new URL(file.url);
        url.search = "";
        return (
          <AuthorizedEmbed
            token={token || undefined}
            url={url.toString()}
            style={styles?.pdf}
            className={classNames?.pdf}
          />
        );
      }
    },
    {
      regex: /^application\/zip/,
      viewer: () => <Icon name="folderZip" size={72} className={classNames?.zip} />
    }
  ];

  const match = contentTypeMapping.find(({regex}) => regex.test(file.content.type));

  if (match) {
    return match.viewer(file, isLoading || false);
  }

  return <Icon name="fileDocument" size={72} />;
};

export default useFileView;

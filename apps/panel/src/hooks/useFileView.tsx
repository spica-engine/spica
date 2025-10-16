import {Icon, type TypeFile} from "oziko-ui-kit";
import {type CSSProperties} from "react";

type TypeStyle = {
  img?: CSSProperties;
  embed?: CSSProperties;
};

type TypeUseFileView = {
  file?: TypeFile;
  styles?: TypeStyle;
};

const contentTypeMapping = [
  {
    regex: /^image\//,
    viewer: (file: TypeFile, styles?: TypeStyle) => (
      <img src={file.url} alt={file.name} style={styles?.img} />
    )
  },
  {
    regex: /^video\//,
    viewer: () => <Icon name="movie" size={72} />
  },
  {
    regex: /^(text\/plain|text\/javascript|application\/json)$/,
    viewer: (file: TypeFile, styles?: TypeStyle) => (
      <embed type={file.content.type} src={file.url} style={styles?.embed} />
    )
  },
  {
    regex: /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/csv)$/,
    viewer: () => <Icon name="gridOn" size={72} />
  },
  {
    regex: /^application\/pdf/,
    viewer: (file: TypeFile, styles?: TypeStyle) => (
      <embed type={file.content.type} src={file.url} style={styles?.embed} />
    )
  },
  {
    regex: /^application\/zip/,
    viewer: () => <Icon name="folderZip" size={72} />
  }
];

const useFileView = ({file, styles}: TypeUseFileView) => {
  if (!file) {
    return null;
  }

  const match = contentTypeMapping.find(({regex}) => regex.test(file.content.type));

  if (match) {
    return match.viewer(file, styles);
  }

  return <Icon name="fileDocument" size={72} />;
};

export default useFileView;

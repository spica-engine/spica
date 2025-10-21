import {FlexElement} from "oziko-ui-kit";
import styles from "./VideoDisplay.module.scss";
import {memo, type FC} from "react";

type TypeVideoDisplay = {
  width?: string;
  height?: string;
  src?: string;
  title?: string;
  className?: string;
};

const VideoDisplay: FC<TypeVideoDisplay> = ({
  width = "100%",
  height = "175",
  src = "https://www.youtube.com/embed/UKpyAcaZCpU?list=UUCfDC3-r1tIeYfylt_9QVJg",
  title = "Simple Identity Management + Angular | Spica Examples 2",
  className
}) => {

  return (
    <FlexElement dimensionX={"fill"} direction="vertical" gap={10}>
      <iframe
        className={`${styles.video} ${className}`}
        width={width}
        height={height}
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      ></iframe>
    </FlexElement>
  );
};

export default memo(VideoDisplay);

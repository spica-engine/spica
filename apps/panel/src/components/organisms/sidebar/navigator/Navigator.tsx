import {Icon, Text, type IconName, helperUtils, Accordion} from "oziko-ui-kit";
import styles from "./Navigator.module.scss";
import {Button} from "oziko-ui-kit";
import {memo, useMemo} from "react";
import type {
  NavigatorItemGroup,
  TypeNavigatorItem,
  TypeNavigatorHeader
} from "../../../../types/sidebar";
import AddBucketPopup from "../../../../components/molecules/add-bucket-popup/AddBucketPopup";
import {NavigatorHeader} from "./components/navigator-header/NavigatorHeader";
import {ReorderableList} from "./components/reorderable-list/ReorderableList";
import {DefaultNavigatorItem} from "./components/default-navigator-item/DefaultNavigatorItem";
import {AccordionNavigatorItem} from "./components/accordion-navigator-item/AccordionNavigatorItem";

const groupObjectsByCategory = (items: TypeNavigatorItem[]) => {
  const groupedMap = new Map<string, TypeNavigatorItem[]>();
  const ungrouped: TypeNavigatorItem[] = [];
  items.forEach(obj => {
    if (obj.category) {
      if (!groupedMap.has(obj.category)) {
        groupedMap.set(obj.category, []);
      }
      groupedMap.get(obj.category)!.push(obj);
    } else {
      ungrouped.push(obj);
    }
  });

  const grouped = Array.from(groupedMap.values());

  return {
    grouped,
    ungrouped
  };
};

type TypeNavigatorProps = {
  header?: TypeNavigatorHeader;
  items?: NavigatorItemGroup;
  button?: {
    title: string;
    icon: IconName;
    onClick: () => void;
  };
  addNewButtonText?: string;
};

const Navigator = ({header, items, button, addNewButtonText}: TypeNavigatorProps) => {
  const {grouped, ungrouped} = useMemo(() => groupObjectsByCategory(items?.items ?? []), [items]);

  const accordionItems = useMemo(
    () =>
      grouped.map((item, index) => {
        const title = helperUtils.capitalize(item?.[0]?.category ?? "");
        const content = (
          <>
            {item.map((item: TypeNavigatorItem, index: number) => (
              <AccordionNavigatorItem key={item._id} item={item} index={index} />
            ))}
          </>
        );

        const icon = (
          <>
            <Icon name="dragHorizontalVariant" />
            <Icon name="dotsVertical" />
          </>
        );
        const items = [{title, content, icon}];

        return (
          <Accordion
            key={index}
            items={items}
            headerClassName={styles.accordionHeader}
            className={`${styles.accordion} accordion`}
            openClassName={styles.accordionOpen}
            gap={0}
          />
        );
      }),
    [grouped, items]
  );

  const ungroupedItems = useMemo(() => {
    if (!Array.isArray(ungrouped) || !items) return null;
    if (items.onOrderChange) {
      return (
        <ReorderableList
          onOrderChange={items.onOrderChange}
          completeOrderChange={items.completeOrderChange}
          items={ungrouped as TypeNavigatorItem[]}
        />
      );
    }
    return ungrouped.map(item => <DefaultNavigatorItem key={item._id} item={item} />);
  }, [ungrouped]);

  return (
    <div className={styles.navigation}>
      <NavigatorHeader header={header} />
      <div className={styles.items}>
        {accordionItems}
        {ungroupedItems}
        {addNewButtonText && <AddBucketPopup  />}
      </div>
      {button && (
        <Button color="transparent" variant="text">
          <Icon name={button.icon} />
          <Text className={styles.noLineHeight}>{button.title}</Text>
        </Button>
      )}
    </div>
  );
};

export default memo(Navigator);





// /**
//  * @owner Kanan Gasimov
//  * email: rio.kenan@gmail.com
//  */

// import React, {useMemo} from "react";
// import styles from "../Navigation.module.scss";
// import {Accordion, Button, FlexElement, FluidContainer, helperUtils, Icon, Text} from "oziko-ui-kit";
// import {useNavigate} from "react-router-dom";
// import { useGetBucketsQuery } from "../../../../store/api";
// import type { TypeNavigatorItem } from "../../../../types/sidebar";
// import { DefaultNavigatorItem } from "../../../../components/organisms/sidebar/navigator/components/default-navigator-item/DefaultNavigatorItem";
// import { AccordionNavigatorItem } from "../../../../components/organisms/sidebar/navigator/components/accordion-navigator-item/AccordionNavigatorItem";
// import {BucketNavigatorPopupWrapper, type BucketNavigatorPopupWrapperProps} from "../../../../layout/components/BucketNavigatorPopupWrapper";

// const BucketNavigation = () => {
//   const navigate = useNavigate();

//   const {data: buckets = []} = useGetBucketsQuery();

//   const navigatorItems = useMemo(
//     () =>
//       (buckets?.map(bucket => ({
//         _id: bucket._id,
//         section: "bucket",
//         title: bucket.title,
//         icon: undefined,
//         category: bucket.category,
//         link: `/bucket/${bucket._id}`,
//         suffixElements: [
//           (props: BucketNavigatorPopupWrapperProps) => (
//             <BucketNavigatorPopupWrapper {...props} bucket={bucket} />
//           )
//         ]
//       })) ?? []) as TypeNavigatorItem[],
//     [buckets]
//   );

//   const handleViewListClick = () => {
//     navigate("/diagram");
//   };

//   const handleClockOutlineClick = () => {
//     // TODO: Implement clock outline click
//   };

//   const groupObjectsByCategory = (items: TypeNavigatorItem[]) => {
//     const groupedMap = new Map<string, TypeNavigatorItem[]>();
//     const ungrouped: TypeNavigatorItem[] = [];
//     items.forEach(obj => {
//       if (obj.category) {
//         if (!groupedMap.has(obj.category)) {
//           groupedMap.set(obj.category, []);
//         }
//         groupedMap.get(obj.category)!.push(obj);
//       } else {
//         ungrouped.push(obj);
//       }
//     });
  
//     const grouped = Array.from(groupedMap.values());
  
//     return {
//       grouped,
//       ungrouped
//     };
//   };

//   const {grouped, ungrouped} = useMemo(() => groupObjectsByCategory(navigatorItems), [navigatorItems]); 
//   const accordionItems = useMemo(
//     () =>
//       grouped.map((item, index) => {
//         const title = helperUtils.capitalize(item?.[0]?.category ?? "");
//         const content = (
//           <>
//             {item.map((item: TypeNavigatorItem, index: number) => (
//               <AccordionNavigatorItem key={item._id} item={item} index={index} />
//             ))}
//           </>
//         );

//         const icon = (
//           <>
//             <Icon name="dragHorizontalVariant" />
//             <Icon name="dotsVertical" />
//           </>
//         );
//         const items = [{title, content, icon}];

//         return (
//           <Accordion
//             key={index}
//             items={items}
//             headerClassName={styles.accordionHeader}
//             className={`${styles.accordion} accordion`}
//             openClassName={styles.accordionOpen}
//             gap={0}
//           />
//         );
//       }),
//     [grouped, navigatorItems]
//   );
  
//   const ungroupedItems = useMemo(() => {
//     if (!Array.isArray(ungrouped) || !navigatorItems?.length) return null;
//     return ungrouped.map(item => <DefaultNavigatorItem key={item._id} item={item} />);
//   }, [ungrouped, navigatorItems]);
  
//   return (
//     <div className={styles.container}>
//       <FluidContainer
//         dimensionX={"fill"}
//         mode="fill"
//         className={styles.header}
//         root={{
//           children: (
//             <Text dimensionX={"fill"} size="large">
//               Buckets
//             </Text>
//           )
//         }}
//         suffix={{
//           children: (
//             <FlexElement gap={10}>
//               <Button
//                 className={styles.button}
//                 variant="icon"
//                 color="transparent"
//                 onClick={() => handleClockOutlineClick()}

//               >
//                 <Icon name="clockOutline" className={styles.rootItemIcon} />
//               </Button>
//               <Button
//                 className={styles.button}
//                 variant="icon"
//                 color="transparent"
//                 onClick={() => handleViewListClick()}

//               >
//                 <Icon name="viewList" className={styles.rootItemIcon} />
//               </Button>
//             </FlexElement>
//           )
//         }}
//       />
//       <FlexElement direction="vertical" gap={10} dimensionX={"fill"}>
//              {accordionItems}
//              {ungroupedItems}
//       </FlexElement>  
//     </div>
//   );
// };

// export default BucketNavigation;

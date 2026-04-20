import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, FlexElement, Icon, Spinner, type TableColumn } from "oziko-ui-kit";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  useGetIdentitiesQuery,
  useGetIdentityQuery,
  type Identity as IdentityType,
} from "../../store/api/identityApi";
import { useGetPoliciesQuery, type Policy } from "../../store/api/policyApi";
import SpicaTable from "../../components/organisms/table/Table";
import DeleteIdentity from "../../components/prefabs/delete-identity/DeleteIdentity";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import IdentityDrawer from "./IdentityDrawer";
import styles from "../shared/EntityPage.module.scss";
import { useLocation, useNavigate } from "react-router-dom";

const PAGE_SIZE = 20;

const Identity = () => {
  const [skip, setSkip] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const openIdentityId = (location.state as { openIdentityId?: string })?.openIdentityId;

  const { data: identityResponse, isLoading, isFetching } = useGetIdentitiesQuery({
    paginate: true,
    limit: PAGE_SIZE,
    skip,
  });

  const { allItems, hasMore, handleLoadMore, resetList } = useInfiniteList<IdentityType>({
    response: identityResponse,
    isFetching,
    pageSize: PAGE_SIZE,
    skip,
    setSkip,
  });

  const { data: policies } = useGetPoliciesQuery();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityType | null>(null);
  const [profileIdentityId, setProfileIdentityId] = useState<string | null>(null);

  const { data: fetchedProfileIdentity } = useGetIdentityQuery(profileIdentityId!, {
    skip: !profileIdentityId,
  });

  const openDrawerForIdentity = useCallback((identityId: string) => {
    setProfileIdentityId(identityId);
  }, []);

  useEffect(() => {
    if (fetchedProfileIdentity) {
      setSelectedIdentity(fetchedProfileIdentity);
      setIsDrawerOpen(true);
      setProfileIdentityId(null);
    }
  }, [fetchedProfileIdentity]);

  useEffect(() => {
    if (openIdentityId) {
      openDrawerForIdentity(openIdentityId);
      navigate(location.pathname, {replace: true, state: {}});
    }
  }, [openIdentityId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const identityId = (e as CustomEvent<{identityId: string}>).detail.identityId;
      openDrawerForIdentity(identityId);
    };
    window.addEventListener("open-identity-drawer", handler);
    return () => window.removeEventListener("open-identity-drawer", handler);
  }, [openDrawerForIdentity]);

  const policyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (policies ?? []).forEach((p: Policy) => map.set(p._id, p.name));
    return map;
  }, [policies]);

  const handleOpenCreateDrawer = useCallback(() => {
    setSelectedIdentity(null);
    setIsDrawerOpen(true);
  }, []);

  const handleOpenEditDrawer = useCallback((identity: IdentityType) => {
    setSelectedIdentity(identity);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedIdentity(null);
  }, []);

  const columns: TableColumn<IdentityType>[] = useMemo(
    () => [
      {
        header: <FlexElement>#</FlexElement>,
        key: "_id",
        width: "220px",
        minWidth: "220px",
        renderCell: ({ row }) => <span>{row._id}</span>,
      },
      {
        header: <FlexElement>Identifier</FlexElement>,
        key: "identifier",
        width: "200px",
        minWidth: "150px",
        renderCell: ({ row }) => <span>{row.identifier}</span>,
      },
      {
        header: <FlexElement>Policies</FlexElement>,
        key: "policies",
        width: "300px",
        minWidth: "200px",
        renderCell: ({ row }) => {
          const policyNames = (row.policies ?? [])
            .map((id) => policyNameMap.get(id) || id)
            .join(", ");
          return (
            <span className={styles.policiesCell} title={policyNames}>
              {policyNames || "—"}
            </span>
          );
        },
      },
      {
        header: <FlexElement>Last Login</FlexElement>,
        key: "lastLogin",
        width: "180px",
        minWidth: "140px",
        renderCell: ({ row }) => (
          <span>
            {row.lastLogin ? new Date(row.lastLogin).toLocaleString() : "—"}
          </span>
        ),
      },
      {
        header: (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
            Actions
          </FlexElement>
        ),
        key: "actions",
        width: "100px",
        minWidth: "100px",
        renderCell: ({ row }) => (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
            <Button
              variant="icon"
              color="default"
              className={styles.actionButton}
              onClick={() => handleOpenEditDrawer(row)}
            >
              <Icon name="pencil" />
            </Button>
            <DeleteIdentity identity={row} onDeleted={resetList}>
              {({ onOpen }) => (
                <Button
                  variant="icon"
                  color="danger"
                  className={styles.actionButton}
                  onClick={onOpen}
                >
                  <Icon name="delete" />
                </Button>
              )}
            </DeleteIdentity>
          </FlexElement>
        ),
      },
    ],
    [handleOpenEditDrawer, policyNameMap, resetList]
  );

  return (
    <FlexElement
      dimensionX="fill"
      direction="vertical"
      gap={10}
      className={styles.pageContainer}
    >
      <FlexElement
        dimensionX="fill"
        alignment="rightCenter"
        direction="horizontal"
        gap={10}
      >
        <Button onClick={() => {}}>
          <Icon name="filter" /> Filter
        </Button>
        <Button onClick={handleOpenCreateDrawer}>
          <Icon name="plus" /> New Identity
        </Button>
      </FlexElement>

      <div id="identity-scroll-container" className={styles.scrollContainer}>
        <InfiniteScroll
          dataLength={allItems.length}
          next={handleLoadMore}
          hasMore={hasMore}
          loader={
            <FlexElement dimensionX="fill" alignment="center">
              <Spinner size="small" />
            </FlexElement>
          }
          scrollableTarget="identity-scroll-container"
        >
          <SpicaTable
            columns={columns}
            data={allItems}
            isLoading={isLoading}
            skeletonRowCount={10}
          />
        </InfiniteScroll>
      </div>

      <IdentityDrawer
        isOpen={isDrawerOpen}
        selectedIdentity={selectedIdentity}
        onClose={handleCloseDrawer}
      />
    </FlexElement>
  );
};

export default Identity;

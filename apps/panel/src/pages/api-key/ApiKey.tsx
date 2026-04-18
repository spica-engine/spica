import React, { useCallback, useMemo, useState } from "react";
import { Button, FlexElement, Icon, Spinner, type TableColumn } from "oziko-ui-kit";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  useGetApiKeysQuery,
  useDeleteApiKeyMutation,
  type ApiKey as ApiKeyType,
} from "../../store/api/apiKeyApi";
import { useGetPoliciesQuery, type Policy } from "../../store/api/policyApi";
import SpicaTable from "../../components/organisms/table/Table";
import DeleteEntity from "../../components/prefabs/delete-entity/DeleteEntity";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import ApiKeyDrawer from "./ApiKeyDrawer";
import Confirmation from "../../components/molecules/confirmation/Confirmation";
import styles from "./ApiKey.module.scss";
import sharedStyles from "../shared/EntityPage.module.scss";

const PAGE_SIZE = 20;

const ApiKeyPage = () => {
  const [skip, setSkip] = useState(0);

  const {
    data: apiKeyResponse,
    isLoading,
    isFetching,
  } = useGetApiKeysQuery({ limit: PAGE_SIZE, skip });

  const { allItems, hasMore, handleLoadMore, resetList } =
    useInfiniteList<ApiKeyType>({
      response: apiKeyResponse,
      isFetching,
      pageSize: PAGE_SIZE,
      skip,
      setSkip,
    });

  const { data: policies } = useGetPoliciesQuery();
  const [deleteApiKeyMutation] = useDeleteApiKeyMutation();
  const deleteApiKey = useCallback(
    (id: string) => deleteApiKeyMutation(id) as ReturnType<typeof deleteApiKeyMutation> & { unwrap: () => Promise<void> },
    [deleteApiKeyMutation]
  );

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKeyType | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const policyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (policies ?? []).forEach((p: Policy) => map.set(p._id, p.name));
    return map;
  }, [policies]);

  const handleOpenCreateDrawer = useCallback(() => {
    setSelectedApiKey(null);
    setIsDrawerOpen(true);
  }, []);

  const handleOpenEditDrawer = useCallback((apiKey: ApiKeyType) => {
    setSelectedApiKey(apiKey);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedApiKey(null);
  }, []);

  const handleKeyCreated = useCallback((key: string) => {
    setCreatedKey(key);
  }, []);

  const handleDismissKeyBanner = useCallback(() => {
    setCreatedKey(null);
  }, []);

  const handleCopyKey = useCallback(
    (key: string, id?: string) => {
      navigator.clipboard.writeText(key);
      if (id) {
        setCopiedKeyId(id);
        setTimeout(() => setCopiedKeyId(null), 1500);
      }
    },
    []
  );

  const columns: TableColumn<ApiKeyType>[] = useMemo(
    () => [
      {
        header: <FlexElement>#</FlexElement>,
        key: "_id",
        width: "220px",
        minWidth: "220px",
        renderCell: ({ row }) => <span>{row._id}</span>,
      },
          {
        header: <FlexElement>Key</FlexElement>,
        key: "key",
        width: "220px",
        minWidth: "160px",
        renderCell: ({ row }) => (
          <span className={styles.keyCell}>
            <span className={styles.keyText} title={row.key}>
              {row.key || "—"}
            </span>
            {row.key && (
              <Button
                variant="icon"
                color="default"
                className={`${styles.keyCopyButton} ${copiedKeyId === row._id ? styles.keyCopied : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyKey(row.key!, row._id);
                }}
              >
                <Icon name={copiedKeyId === row._id ? "check" : "contentCopy"} />
              </Button>
            )}
          </span>
        ),
      },
      {
        header: <FlexElement>Name</FlexElement>,
        key: "name",
        width: "180px",
        minWidth: "140px",
        renderCell: ({ row }) => <span>{row.name}</span>,
      },
      {
        header: <FlexElement>Description</FlexElement>,
        key: "description",
        width: "250px",
        minWidth: "180px",
        renderCell: ({ row }) => (
          <span title={row.description}>{row.description || "—"}</span>
        ),
      },

      {
        header: <FlexElement>Policies</FlexElement>,
        key: "policies",
        width: "250px",
        minWidth: "180px",
        renderCell: ({ row }) => {
          const policyNames = (row.policies ?? [])
            .map((id) => policyNameMap.get(id) || id)
            .join(", ");
          return (
            <span className={sharedStyles.policiesCell} title={policyNames}>
              {policyNames || "—"}
            </span>
          );
        },
      },
      {
        header: <FlexElement>Status</FlexElement>,
        key: "active",
        width: "120px",
        minWidth: "100px",
        renderCell: ({ row }) => (
          <span
            className={
              row.active !== false ? styles.statusActive : styles.statusInactive
            }
          >
            <span className={styles.statusDot} />
            {row.active !== false ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        header: (
          <FlexElement
            dimensionX="fill"
            alignment="rightCenter"
            direction="horizontal"
          >
            Actions
          </FlexElement>
        ),
        key: "actions",
        width: "100px",
        minWidth: "100px",
        renderCell: ({ row }) => (
          <FlexElement
            dimensionX="fill"
            alignment="rightCenter"
            direction="horizontal"
          >
            <Button
              variant="icon"
              color="default"
              className={sharedStyles.actionButton}
              onClick={() => handleOpenEditDrawer(row)}
            >
              <Icon name="pencil" />
            </Button>
            <DeleteEntity
              entityId={row._id!}
              entityName={row.name}
              entityLabel="API KEY"
              deleteMutation={deleteApiKey}
              onDeleted={resetList}
            >
              {({ onOpen }) => (
                <Button
                  variant="icon"
                  color="danger"
                  className={sharedStyles.actionButton}
                  onClick={onOpen}
                >
                  <Icon name="delete" />
                </Button>
              )}
            </DeleteEntity>
          </FlexElement>
        ),
      },
    ],
    [
      handleOpenEditDrawer,
      policyNameMap,
      resetList,
      deleteApiKey,
      handleCopyKey,
      copiedKeyId,
    ]
  );

  return (
    <FlexElement
      dimensionX="fill"
      direction="vertical"
      gap={10}
      className={sharedStyles.pageContainer}
    >
      <FlexElement
        dimensionX="fill"
        alignment="rightCenter"
        direction="horizontal"
        gap={10}
      >
        <Button onClick={handleOpenCreateDrawer}>
          <Icon name="plus" /> New API Key
        </Button>
      </FlexElement>

      <div id="apikey-scroll-container" className={sharedStyles.scrollContainer}>
        <InfiniteScroll
          dataLength={allItems.length}
          next={handleLoadMore}
          hasMore={hasMore}
          loader={
            <FlexElement dimensionX="fill" alignment="center">
              <Spinner size="small" />
            </FlexElement>
          }
          scrollableTarget="apikey-scroll-container"
        >
          <SpicaTable
            columns={columns}
            data={allItems}
            isLoading={isLoading}
            skeletonRowCount={10}
          />
        </InfiniteScroll>
      </div>

      <ApiKeyDrawer
        isOpen={isDrawerOpen}
        selectedApiKey={selectedApiKey}
        onClose={handleCloseDrawer}
        onKeyCreated={handleKeyCreated}
      />
    </FlexElement>
  );
};

export default ApiKeyPage;

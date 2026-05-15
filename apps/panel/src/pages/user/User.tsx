import React, { useCallback, useMemo, useState } from "react";
import { Button, FlexElement, Icon, Spinner, Table, type TableColumn } from "oziko-ui-kit";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  useGetUsersQuery,
  type User as UserType,
} from "../../store/api/userApi";
import { useGetPoliciesQuery, type Policy } from "../../store/api/policyApi";
import DeleteUser from "../../components/prefabs/delete-user/DeleteUser";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import UserDrawer from "./UserDrawer";
import UserActionBar from "../../components/molecules/user-action-bar/UserActionBar";
import bucketStyles from "../bucket/Bucket.module.scss";
import styles from "../shared/EntityPage.module.scss";

const PAGE_SIZE = 20;

const User = () => {
  const [skip, setSkip] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<Record<string, any> | null>(null);

  const { currentData: userResponse, isLoading, isFetching } = useGetUsersQuery({
    paginate: true,
    limit: PAGE_SIZE,
    skip,
    ...(appliedFilter ? {filter: appliedFilter} : {}),
  });

  const { allItems, hasMore, handleLoadMore, resetList } = useInfiniteList<UserType>({
    response: userResponse,
    isFetching,
    pageSize: PAGE_SIZE,
    queryKey: JSON.stringify(appliedFilter ?? null),
    skip,
    setSkip,
  });

  const { data: policies } = useGetPoliciesQuery();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  const policyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (policies ?? []).forEach((p: Policy) => map.set(p._id, p.name));
    return map;
  }, [policies]);

  const handleOpenCreateDrawer = useCallback(() => {
    setSelectedUser(null);
    setIsDrawerOpen(true);
  }, []);

  const handleOpenEditDrawer = useCallback((user: UserType) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedUser(null);
  }, []);

  const getStatusLabel = useCallback((bannedUntil?: string) => {
    if (!bannedUntil) return "Active";
    const bannedDate = new Date(bannedUntil);
    if (bannedDate > new Date()) return `Banned until ${bannedDate.toLocaleDateString()}`;
    return "Active";
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(
      (item) =>
        item.username?.toLowerCase().includes(q) ||
        item._id?.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  const columns: TableColumn<UserType>[] = useMemo(
    () => [
      {
        header: <FlexElement>#</FlexElement>,
        key: "_id",
        width: "220px",
        minWidth: "220px",
        renderCell: ({ row }) => <span>{row._id}</span>,
      },
      {
        header: <FlexElement>Username</FlexElement>,
        key: "username",
        width: "200px",
        minWidth: "150px",
        renderCell: ({ row }) => <span>{row.username}</span>,
      },
      {
        header: <FlexElement>Policies</FlexElement>,
        key: "policies",
        width: "250px",
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
        header: <FlexElement>Status</FlexElement>,
        key: "status",
        width: "160px",
        minWidth: "120px",
        renderCell: ({ row }) => <span>{getStatusLabel(row.bannedUntil)}</span>,
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
            <DeleteUser user={row} onDeleted={resetList}>
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
            </DeleteUser>
          </FlexElement>
        ),
      },
    ],
    [handleOpenEditDrawer, policyNameMap, getStatusLabel, resetList]
  );

  return (
    <div className={bucketStyles.container}>
      <UserActionBar
        onSearch={setSearchQuery}
        onNewUser={handleOpenCreateDrawer}
        onFilter={(filter) => {
          setAppliedFilter(filter);
          setSkip(0);
        }}
      />

      <div id="user-scroll-container" className={styles.scrollContainer}>
        <InfiniteScroll
          dataLength={filteredItems.length}
          next={handleLoadMore}
          hasMore={hasMore}
          loader={
            <FlexElement dimensionX="fill" alignment="center">
              <Spinner size="small" />
            </FlexElement>
          }
          scrollableTarget="user-scroll-container"
        >
          <Table
            columns={columns}
            data={filteredItems}
            loading={isLoading}
            skeletonRowCount={10}
            onRowClick={({ row }) => handleOpenEditDrawer(row)}
            emptyState={{
              title: "No users found",
              description: "There are no users yet. Create one to get started.",
              actions: (
                <Button onClick={handleOpenCreateDrawer}>
                  <Icon name="plus" size={14} />
                  New User
                </Button>
              ),
            }}
          />
        </InfiniteScroll>
      </div>

      <UserDrawer
        isOpen={isDrawerOpen}
        selectedUser={selectedUser}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};

export default User;

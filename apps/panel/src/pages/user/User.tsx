import React, { useCallback, useMemo, useState } from "react";
import { Button, FlexElement, Icon, Spinner, type TableColumn } from "oziko-ui-kit";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  useGetUsersQuery,
  type User as UserType,
} from "../../store/api/userApi";
import { useGetPoliciesQuery, type Policy } from "../../store/api/policyApi";
import SpicaTable from "../../components/organisms/table/Table";
import DeleteUser from "../../components/prefabs/delete-user/DeleteUser";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import UserDrawer from "./UserDrawer";
import styles from "../shared/EntityPage.module.scss";

const PAGE_SIZE = 20;

const User = () => {
  const [skip, setSkip] = useState(0);

  const { data: userResponse, isLoading, isFetching } = useGetUsersQuery({
    paginate: true,
    limit: PAGE_SIZE,
    skip,
  });

  const { allItems, hasMore, handleLoadMore, resetList } = useInfiniteList<UserType>({
    response: userResponse,
    isFetching,
    pageSize: PAGE_SIZE,
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
        <Button onClick={handleOpenCreateDrawer}>
          <Icon name="plus" /> New User
        </Button>
      </FlexElement>

      <div id="user-scroll-container" className={styles.scrollContainer}>
        <InfiniteScroll
          dataLength={allItems.length}
          next={handleLoadMore}
          hasMore={hasMore}
          loader={
            <FlexElement dimensionX="fill" alignment="center">
              <Spinner size="small" />
            </FlexElement>
          }
          scrollableTarget="user-scroll-container"
        >
          <SpicaTable
            columns={columns}
            data={allItems}
            isLoading={isLoading}
            skeletonRowCount={10}
          />
        </InfiniteScroll>
      </div>

      <UserDrawer
        isOpen={isDrawerOpen}
        selectedUser={selectedUser}
        onClose={handleCloseDrawer}
      />
    </FlexElement>
  );
};

export default User;

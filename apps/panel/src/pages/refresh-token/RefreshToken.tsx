import React, { useCallback, useMemo, useState } from "react";
import { Button, FlexElement, Icon, type TableColumn } from "oziko-ui-kit";
import {
  useGetRefreshTokensQuery,
  useUpdateRefreshTokenMutation,
  useDeleteRefreshTokenMutation,
} from "../../store/api/refreshTokenApi";
import type { RefreshToken } from "../../store/api/refreshTokenApi";
import SpicaTable from "../../components/organisms/table/Table";
import Confirmation from "../../components/molecules/confirmation/Confirmation";
import styles from "./RefreshToken.module.scss";

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const RefreshTokenPage = () => {
  const { data: response, isLoading } = useGetRefreshTokensQuery({ limit: 100, skip: 0 });
  const [updateRefreshToken] = useUpdateRefreshTokenMutation();
  const [deleteRefreshToken, { isLoading: isDeleting }] = useDeleteRefreshTokenMutation();

  const [tokenToDelete, setTokenToDelete] = useState<RefreshToken | null>(null);

  const handleToggleDisabled = useCallback(
    async (token: RefreshToken) => {
      try {
        await updateRefreshToken({
          id: token._id,
          disabled: !token.disabled,
        }).unwrap();
      } catch {
        // Error handled by RTK Query
      }
    },
    [updateRefreshToken]
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent, token: RefreshToken) => {
    e.stopPropagation();
    setTokenToDelete(token);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!tokenToDelete) return;
    try {
      await deleteRefreshToken(tokenToDelete._id).unwrap();
      setTokenToDelete(null);
    } catch {
      // Error handled by RTK Query
    }
  }, [tokenToDelete, deleteRefreshToken]);

  const handleCancelDelete = useCallback(() => setTokenToDelete(null), []);

  const tokens = response?.data ?? [];

  const columns: TableColumn<RefreshToken>[] = useMemo(
    () => [
      {
        header: <FlexElement>#</FlexElement>,
        key: "_id",
        renderCell: ({ row }) => (
          <span className={styles.idCell} title={row._id}>
            {row._id.slice(-8)}
          </span>
        ),
      },
      {
        header: <FlexElement>Identity</FlexElement>,
        key: "identity",
        renderCell: ({ row }) => <span>{row.identity ?? "—"}</span>,
      },
      {
        header: <FlexElement>Created</FlexElement>,
        key: "created_at",
        renderCell: ({ row }) => <span>{formatDate(row.created_at)}</span>,
      },
      {
        header: <FlexElement>Expires</FlexElement>,
        key: "expired_at",
        renderCell: ({ row }) => <span>{formatDate(row.expired_at)}</span>,
      },
      {
        header: <FlexElement>Last Used</FlexElement>,
        key: "last_used_at",
        renderCell: ({ row }) => <span>{formatDate(row.last_used_at)}</span>,
      },
      {
        header: <FlexElement>Status</FlexElement>,
        key: "disabled",
        width: "100px",
        minWidth: "100px",
        renderCell: ({ row }) => (
          <span className={row.disabled ? styles.statusDisabled : styles.statusActive}>
            {row.disabled ? "Disabled" : "Active"}
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
              onClick={() => handleToggleDisabled(row)}
              title={row.disabled ? "Enable token" : "Disable token"}
            >
              <Icon name={row.disabled ? "refresh" : "lock"} />
            </Button>
            <Button
              variant="icon"
              color="danger"
              className={styles.actionButton}
              onClick={(e) => handleDeleteClick(e, row)}
            >
              <Icon name="delete" />
            </Button>
          </FlexElement>
        ),
      },
    ],
    [handleToggleDisabled, handleDeleteClick]
  );

  return (
    <FlexElement
      dimensionX="fill"
      direction="vertical"
      gap={10}
      className={styles.container}
    >
      <SpicaTable
        data={tokens}
        columns={columns}
        isLoading={isLoading}
        skeletonRowCount={10}
      />

      {tokenToDelete && (
        <Confirmation
          title="DELETE REFRESH TOKEN"
          description={
            <>
              This action will <b>permanently</b> revoke this refresh token. The associated identity
              will no longer be able to use it to obtain new access tokens.
            </>
          }
          showInput={false}
          confirmLabel={
            <>
              <Icon name="delete" /> Delete
            </>
          }
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          loading={isDeleting}
        />
      )}
    </FlexElement>
  );
};

export default RefreshTokenPage;

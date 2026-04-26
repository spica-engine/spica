import React, {useState, useCallback} from "react";
import {useGetUserProfileQuery} from "../../store/api/userApi";
import ProfilerTable from "../../components/organisms/profiler-table/ProfilerTable";

const PAGE_SIZE = 20;

const UserProfiler = () => {
  const [skip, setSkip] = useState(0);
  const [opFilter, setOpFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<1 | -1>(-1);

  const {data: entries = [], isLoading, isFetching, refetch} = useGetUserProfileQuery({
    limit: PAGE_SIZE,
    skip,
    sort: {ts: sortOrder},
    ...(opFilter ? {filter: {op: opFilter}} : {}),
  });

  const handleFilterChange = useCallback((value: string) => {
    setOpFilter(value);
    setSkip(0);
  }, []);

  const handleToggleSort = useCallback(() => {
    setSortOrder(prev => (prev === -1 ? 1 : -1));
    setSkip(0);
  }, []);

  return (
    <ProfilerTable
      title="User Profiler"
      subtitle="— MongoDB profiler entries for the user collection"
      entries={entries}
      isLoading={isLoading}
      isFetching={isFetching}
      skip={skip}
      pageSize={PAGE_SIZE}
      opFilter={opFilter}
      sortOrder={sortOrder}
      onFilterChange={handleFilterChange}
      onToggleSort={handleToggleSort}
      onRefetch={refetch}
      onPrevPage={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
      onNextPage={() => setSkip(skip + PAGE_SIZE)}
    />
  );
};

export default UserProfiler;

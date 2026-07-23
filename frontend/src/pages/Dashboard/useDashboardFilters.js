import { useEffect, useState } from "react";

import moment from "moment";
import { isArray, isEmpty } from "lodash";
import { toast } from "react-toastify";

import useDashboard from "../../hooks/useDashboard";

/**
 * Estado e carga do Dashboard (doc 03, fase F2).
 *
 * Concentra os filtros (tipo/período/datas), o disparo do fetch (via
 * useDashboard → DashboardApi) e os dados resultantes (counters/attendants).
 * O index fica só com layout + composição.
 */
const useDashboardFilters = () => {
  const { find } = useDashboard();

  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [period, setPeriod] = useState(0);
  const [filterType, setFilterType] = useState(1);
  const [dateFrom, setDateFrom] = useState(
    moment("1", "D").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function firstLoad() {
      await fetchData();
    }
    setTimeout(() => {
      firstLoad();
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangePeriod = (value) => {
    setPeriod(value);
  };

  const handleChangeFilterType = (value) => {
    setFilterType(value);
    if (value === 1) {
      setPeriod(0);
    } else {
      setDateFrom("");
      setDateTo("");
    }
  };

  async function fetchData() {
    setLoading(true);

    let params = {};

    if (period > 0) {
      params = {
        days: period,
      };
    }

    if (!isEmpty(dateFrom) && moment(dateFrom).isValid()) {
      params = {
        ...params,
        date_from: moment(dateFrom).format("YYYY-MM-DD"),
      };
    }

    if (!isEmpty(dateTo) && moment(dateTo).isValid()) {
      params = {
        ...params,
        date_to: moment(dateTo).format("YYYY-MM-DD"),
      };
    }

    if (Object.keys(params).length === 0) {
      toast.error("Parametrize o filtro");
      setLoading(false);
      return;
    }

    const data = await find(params);

    setCounters(data.counters);
    if (isArray(data.attendants)) {
      setAttendants(data.attendants);
    } else {
      setAttendants([]);
    }

    setLoading(false);
  }

  return {
    counters,
    attendants,
    period,
    filterType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    loading,
    handleChangePeriod,
    handleChangeFilterType,
    fetchData,
  };
};

export default useDashboardFilters;

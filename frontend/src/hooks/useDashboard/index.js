import { dashboardApi } from "../../api/DashboardApi";

const useDashboard = () => {

    const find = async (params) => {
        const { data } = await dashboardApi.find(params);
        return data;
    }

    return {
        find
    }
}

export default useDashboard;
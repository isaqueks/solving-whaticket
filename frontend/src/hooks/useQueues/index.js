import { queuesApi } from "../../api/QueuesApi";

const useQueues = () => {
	const findAll = async () => {
        const { data } = await queuesApi.findAll();
        return data;
    }

	return { findAll };
};

export default useQueues;
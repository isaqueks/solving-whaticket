import { ticketNotesApi } from "../../api/TicketNotesApi";

const useTicketNotes = () => {

    const saveNote = async (data) => {
        const { data: responseData } = await ticketNotesApi.save(data);
        return responseData;
    }

    const deleteNote = async (id) => {
        const { data } = await ticketNotesApi.remove(id);
        return data;
    }

    const listNotes = async (params) => {
        const { data } = await ticketNotesApi.list(params);
        return data;
    }

    return {
        saveNote,
        deleteNote,
        listNotes
    }
}

export default useTicketNotes;
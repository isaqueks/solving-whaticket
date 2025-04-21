import { makeStyles } from "@material-ui/styles";
import React from "react";

const useStyles = makeStyles(theme => ({
    tag: {
        color: "#FFF",
        padding: "3px 7px",
        // fontWeight: "bold",
        borderRadius: 5,
        fontSize: "0.75rem",
        whiteSpace: "nowrap",
    }
}));

const ContactTag = ({ tag }) => {
    const classes = useStyles();

    return (
        <div className={classes.tag} style={{ backgroundColor: tag.color, marginTop: "2px" }}>
            {tag.name.toUpperCase()}
        </div>
    )
}

export default ContactTag;
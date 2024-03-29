import Colors from "./diagram/Colors";
import React, { FC, useState, useEffect } from "react";
import { atom, useAtom } from "jotai";
import PubSub from "pubsub-js";
import { makeStyles } from "@mui/styles";
import {
  Box,
  Dialog,
  Button,
  ListItem,
  ListItemIcon,
  Typography,
  Menu,
  MenuItem,
  Tooltip,
  TextField,
} from "@mui/material";

import {
  defaultIconKey,
  greenNumberIconKey,
  noImageIconKey,
  icons,
} from "../common/icons";
import { FixedSizeList } from "react-window";
import { useLocalStorage } from "../common/useLocalStorage";
import CheckIcon from "@mui/icons-material/Check";
import CheckBoxOutlineBlank from "@mui/icons-material/CheckBoxOutlineBlank";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";


const subItemsSize = 12;
const mruSize = 8;
const iconsSize = 30;
const tooltipIconSize = 140;
const selectIconSize = 20;
const subItemsHeight = iconsSize + 6;
const allIcons = icons.getAllIcons();
const defaultIconSets = ["Azure", "Aws", "OSA"];

const nodesAtom = atom(false);
const useNodes = () => useAtom(nodesAtom);

type SearchBarPar = {
  value: string;
  onChange: any;
};

const SearchBar: FC<SearchBarPar> = ({ value, onChange }) => (
  <form>
    <TextField fullWidth
      id="search-bar"
      className="text"
      onInput={(e: any) => { onChange(e.target.value); }}
      label=""
      defaultValue={value}
      variant="outlined"
      placeholder="Search..."
      size="small"
    />
  </form>
);

const useStyles = makeStyles((theme: any) => ({
  root: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.palette.background.paper,
    position: "relative",
    overflow: "auto",
    maxHeight: 300,
  },
  topScrollPaper: {
    alignItems: "flex-start",
  },
  topPaperScrollBody: {
    verticalAlign: "top",
  },
  nested: {
    paddingLeft: theme.spacing(4),
  },
  listSection: {
    backgroundColor: "inherit",
  },
  ul: {
    backgroundColor: "inherit",
    padding: 0,
  },
}));

export default function Nodes() {
  const classes = useStyles();
  const [show, setShow] = useNodes();
  const [filter, setFilter] = useState("");
  const [mruNodes, setMruNodes] = useLocalStorage("nodes.nodesMru", []);
  const [mruGroups, setMruGroups] = useLocalStorage("nodes.groupsMru", []);
  const [iconSets, setIconSets] = useLocalStorage(
    "nodes.iconSets",
    defaultIconSets
  );
  const [groupType, setGroupType] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // @ts-ignore
  useEffect(() => {
    // Listen for nodes.showDialog commands to show this Nodes dialog
    PubSub.subscribe("nodes.showDialog", (_, data) => {
      setShow(data);
      setGroupType(!!data.group);
    });
    return () => PubSub.unsubscribe("nodes.showDialog");
  }, [setShow]);

  var [mru, setMru] = [mruNodes, setMruNodes];
  if (groupType) {
    [mru, setMru] = [mruGroups, setMruGroups];
  }

  // Handle search
  // eslint-disable-next-line 
  const onChangeSearch = (value: string) => setFilter(value.toLowerCase());
  // eslint-disable-next-line 
  const cancelSearch = () => setFilter("");

  const titleType = groupType ? "Container" : "Icon";
  // @ts-ignore
  const title = !!show && show.add ? `Add ${titleType}` : `Change Icon`;

  const addToMru = (list: string[], key: string) => {
    const newList = [
      key,
      ...list.filter((k: string) => k !== key && k !== defaultIconKey),
    ].slice(0, mruSize);
    return newList;
  };

  const clickedIconItem = (item: any) => {
    setShow(false);
    setGroupType(false);
    setMru(addToMru(mru, item.key));
    setFilter("");

    // @ts-ignore
    if (show.action) {
      // @ts-ignore
      show.action(item.key);
      return;
    }

    // show value can be a position or just 'true'. Is position, then the new node will be added
    // at that position. But is value is 'true', the new node position will centered in the diagram
    var position = null;

    // @ts-ignore
    if (show.x) {
      // @ts-ignore
      position = { x: show.x, y: show.y };
    }

    PubSub.publish("canvas.AddNode", {
      icon: item.key,
      position: position,
      group: groupType,
    });
  };

  const handleIconSetsSelect = (iconSet: string) => {
    if (iconSets.includes(iconSet)) {
      const sets = iconSets.filter((i: string) => i !== iconSet);
      setIconSets(sets);
    } else {
      const sets = iconSets.concat([iconSet]);
      setIconSets(sets);
    }
  };

  const boxWidth = window.innerWidth > 600 ? 400 : 270;
  const menuX = boxWidth - 63;

  return (
    <Dialog
      open={!!show}
      onClose={() => {
        setShow(false);
        setGroupType(false);
        setFilter("");
      }}
      classes={{
        scrollPaper: classes.topScrollPaper,
        paperScrollBody: classes.topPaperScrollBody,
      }}
    >
      <Box style={{ width: boxWidth, height: 515, padding: 20 }}>
        <Typography variant="h6">{title}</Typography>

        <Button
          style={{
            position: "absolute",
            top: 20,
            left: menuX,
            paddingTop: 5,
            paddingBottom: 5,
          }}
          disableElevation
          onClick={(e: any) => setAnchorEl(e.currentTarget)}
          endIcon={<KeyboardArrowDownIcon />}
        >
          Icons
        </Button>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          <MenuItem onClick={() => handleIconSetsSelect("Azure")}>
            <ListItemIcon>
              {iconSets.includes("Azure") && <CheckIcon fontSize="small" />}
              {!iconSets.includes("Azure") && (
                <CheckBoxOutlineBlank fontSize="small" />
              )}
              <img
                src={icons.getIcon("Azure").src}
                alt=""
                width={selectIconSize}
                height={selectIconSize}
              />
            </ListItemIcon>
            Azure
          </MenuItem>
          <MenuItem onClick={() => handleIconSetsSelect("Aws")}>
            <ListItemIcon>
              {iconSets.includes("Aws") && <CheckIcon fontSize="small" />}
              {!iconSets.includes("Aws") && (
                <CheckBoxOutlineBlank fontSize="small" />
              )}
              <img
                src={icons.getIcon("Aws").src}
                alt=""
                width={selectIconSize}
                height={selectIconSize}
              />
            </ListItemIcon>
            Aws
          </MenuItem>
          <MenuItem onClick={() => handleIconSetsSelect("Google")}>
            <ListItemIcon>
              {iconSets.includes("Google") && <CheckIcon fontSize="small" />}
              {!iconSets.includes("Google") && (
                <CheckBoxOutlineBlank fontSize="small" />
              )}
              <img
                src={icons.getIcon("Google").src}
                alt=""
                width={selectIconSize}
                height={selectIconSize}
              />
            </ListItemIcon>
            Google
          </MenuItem>
          <MenuItem onClick={() => handleIconSetsSelect("OSA")}>
            <ListItemIcon>
              {iconSets.includes("OSA") && <CheckIcon fontSize="small" />}
              {!iconSets.includes("OSA") && (
                <CheckBoxOutlineBlank fontSize="small" />
              )}
              <img
                src={icons.getIcon("OSA").src}
                alt=""
                width={selectIconSize}
                height={selectIconSize}
              />
            </ListItemIcon>
            OSA
          </MenuItem>
        </Menu>

        {<SearchBar
          value={filter}
          onChange={(searchVal: string) => onChangeSearch(searchVal)}
        />}

        {NodesList(iconSets, mru, filter, groupType, clickedIconItem)}
      </Box>
    </Dialog>
  );
}

const NodesList = (
  roots: string[],
  mru: string[],
  filter: string,
  groupType: boolean,
  clickedItem: any
) => {
  const filteredItems = filterItems(mru, roots, filter, groupType);
  const items = groupedItems(filteredItems);
  const height = Math.min(items.length, subItemsSize) * subItemsHeight;

  const renderRow = (props: any, items: any[]) => {
    const { index, style } = props;
    const item = items[index];

    if (item.groupHeader) {
      return (
        <ListItem key={index} button style={style} disableGutters>
          <Typography variant="caption">
            {item.groupHeader.replace("/", " - ")}
          </Typography>
        </ListItem>
      );
    }

    return (
      <ListItem
        key={index}
        button
        style={style}
        onClick={() => clickedItem(item)}
        disableGutters
      >
        <Tooltip
          title={
            <img
              src={item.src}
              alt=""
              width={tooltipIconSize}
              height={tooltipIconSize}
              style={{ background: Colors.canvasDivBackground, padding: 10 }}
            />
          }
        >
          <ListItemIcon>
            <img src={item.src} alt="" width={iconsSize} height={iconsSize} />
          </ListItemIcon>
        </Tooltip>
        <Typography variant="body2" style={{ lineHeight: "95%" }}>
          {item.name}
        </Typography>
      </ListItem>
    );
  };

  return (
    <FixedSizeList
      width="ltr"
      height={height}
      itemSize={subItemsHeight}
      itemCount={items.length}
      style={{ marginTop: 5 }}
    >
      {(props) => renderRow(props, items)}
    </FixedSizeList>
  );
};

const groupedItems = (items: any[]) => {
  var it = [];
  var group = "";
  for (var i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.key !== greenNumberIconKey && item.key !== noImageIconKey) {
      const itemGroup = items[i].isMru
        ? "Recently used"
        : items[i].root + ": " + items[i].group;
      if (itemGroup !== group) {
        group = itemGroup;
        it.push({ groupHeader: itemGroup });
      }
    }
    it.push(items[i]);
  }

  return it;
};

// Filter node items based on root and filter
// This filter uses implicit 'AND' between words in the search filter
const filterItems = (
  mru: string[],
  roots: string[],
  filter: string,
  groupType: boolean
) => {
  const filterWords = filter.split(" ");

  const items = allIcons.filter((item: any) => {
    // Check if root items match (e.g. searching Azure or Aws)
    if (!roots.includes(item.root)) {
      return false;
    }

    return isItemInFilterWords(item, filterWords);
  });

  // Some icons exist in multiple groups, lets get unique items
  const uniqueItems = items.filter(
    (item, index) =>
      index ===
      items.findIndex((it) => it.src === item.src && it.name === item.name)
  );

  const mruItems = mru
    .filter((mruItem: string) => {
      if (
        mruItem === defaultIconKey ||
        mruItem === greenNumberIconKey ||
        mruItem === noImageIconKey
      ) {
        return false;
      }

      const item = icons.getIcon(mruItem);
      return isItemInFilterWords(item, filterWords);
    })
    .map((item) => ({ ...icons.getIcon(item), isMru: true }));

  if (groupType) {
    const noneItem = icons.getIcon(noImageIconKey);
    return [noneItem].concat(mruItems, uniqueItems);
  } else {
    const numberItem = icons.getIcon(greenNumberIconKey);
    return [numberItem].concat(mruItems, uniqueItems);
  }
};

const isItemInFilterWords = (item: any, filterWords: string[]) => {
  // Check if all filter words are part of the items full name
  for (var i = 0; i < filterWords.length; i++) {
    if (!item.fullName.toLowerCase().includes(filterWords[i])) {
      return false;
    }
  }
  return true;
};

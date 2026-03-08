import React, { PropsWithChildren } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  LightMode,
  Input,
  Wrap,
  Text,
  Tag,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  ButtonGroup,
} from "@chakra-ui/react";
import { useIsLargeScreen } from "../utils/screenSize";
import { useMutation } from "react-query";
import { TorrClient } from "../utils/TorrClient";
import { IoCheckmark, IoChevronDown, IoTv, IoFilm } from "react-icons/io5";
import { useLocalStorage } from "usehooks-ts";
import { pushToServarr } from "../utils/ServarrClient";
import { extractReleaseMarkers } from "../utils/releaseMarkers";

export interface TorrentDownloadBoxProps {
  title?: string;
  filenameHint?: string;
  magnetURL?: string;
  onSelect?: () => Promise<string>;
  category?: string;
}

const TorrentDownloadBox = ({
  magnetURL,
  title,
  filenameHint,
  onSelect,
  children,
  category,
}: PropsWithChildren<TorrentDownloadBoxProps>) => {
  const isLarge = useIsLargeScreen();
  const markers = extractReleaseMarkers(`${title || ""} ${filenameHint || ""}`);

  const [sonarrUrl] = useLocalStorage("iqbit-sonarr-url", "");
  const [radarrUrl] = useLocalStorage("iqbit-radarr-url", "");
  const [quickSavePath, setQuickSavePath] = useLocalStorage(
    "iqbit-search-save-path",
    ""
  );

  const { mutate, isLoading, isSuccess } = useMutation(
    "addBox",
    (params: { magnetURLParam: string; savePath?: string }) =>
      TorrClient.addTorrent(
        "urls",
        params.magnetURLParam,
        category,
        params.savePath || ""
      )
  );

  const { mutate: mutateSonarr, isLoading: isSonarrLoading, isSuccess: isSonarrSuccess } = useMutation(
    "addBoxSonarr",
    (magnetURLParam: string) => pushToServarr("Sonarr", title || "Unknown", magnetURLParam)
  );

  const { mutate: mutateRadarr, isLoading: isRadarrLoading, isSuccess: isRadarrSuccess } = useMutation(
    "addBoxRadarr",
    (magnetURLParam: string) => pushToServarr("Radarr", title || "Unknown", magnetURLParam)
  );

  const {
    mutate: callbackMutation,
    isLoading: callbackLoading,
    isSuccess: callbackSuccess,
  } = useMutation("addBoxWithCallback", (target: "qbit" | "sonarr" | "radarr") => Promise.all([onSelect!(), target] as const), {
    onSuccess: ([magnetUrlResult, target]) => {
      if (target === "sonarr") mutateSonarr(magnetUrlResult);
      else if (target === "radarr") mutateRadarr(magnetUrlResult);
      else
        mutate({
          magnetURLParam: magnetUrlResult,
          savePath: quickSavePath.trim(),
        });
    },
  });

  const anyLoading = isLoading || callbackLoading || isSonarrLoading || isRadarrLoading;
  const anySuccess = isSuccess || callbackSuccess || isSonarrSuccess || isRadarrSuccess;

  const bgColor = useColorModeValue("grayAlpha.200", "grayAlpha.400");

  return (
    <Flex
      p={3}
      bgColor={bgColor}
      width={"100%"}
      justifyContent={"space-between"}
      rounded={6}
      alignItems={"center"}
      gap={3}
      wrap={{ base: "wrap", lg: "nowrap" }}
    >
      <Box flexGrow={2}>
        {title && (
          <Heading wordBreak={"break-all"} size={"md"} mb={2}>
            {title}
          </Heading>
        )}
        {markers.length > 0 && (
          <Wrap spacing={2} mb={2}>
            {markers.map((marker) => (
              <Tag key={marker} size={"sm"} colorScheme={"blue"} variant={"subtle"}>
                {marker}
              </Tag>
            ))}
          </Wrap>
        )}
        {filenameHint && (
          <Text fontSize={"xs"} color={"gray.500"} mb={2} wordBreak={"break-all"}>
            {filenameHint}
          </Text>
        )}
        <Box mb={2}>
          <Text fontSize={"xs"} color={"gray.500"} mb={1}>
            Save Path (optional)
          </Text>
          <Input
            size={"sm"}
            value={quickSavePath}
            placeholder={"Leave empty for default path"}
            onChange={(e) => setQuickSavePath(e.target.value)}
          />
        </Box>
        {children}
      </Box>
      <LightMode>
        <Flex width="100%">
          <ButtonGroup isAttached width={!isLarge ? "100%" : undefined} flexGrow={1}>
            <Button
              minW={32}
              disabled={anySuccess || anyLoading}
              isLoading={isLoading || callbackLoading}
              colorScheme={"blue"}
              width={"100%"}
              onClick={() => {
                if (magnetURL)
                  mutate({
                    magnetURLParam: magnetURL,
                    savePath: quickSavePath.trim(),
                  });
                else if (onSelect) callbackMutation("qbit");
              }}
              leftIcon={anySuccess ? <IoCheckmark /> : undefined}
            >
              {anySuccess ? "Sent" : "Download"}
            </Button>

            {(sonarrUrl || radarrUrl) && (
              <Menu>
                <MenuButton
                  as={Button}
                  colorScheme="blue"
                  disabled={anySuccess || anyLoading}
                  px={2}
                  borderLeft="1px solid"
                  borderColor="blue.600"
                >
                  <IoChevronDown />
                </MenuButton>
                <MenuList color="black">
                  {sonarrUrl && (
                    <MenuItem
                      icon={<IoTv />}
                      onClick={() => {
                        if (magnetURL) mutateSonarr(magnetURL);
                        else if (onSelect) callbackMutation("sonarr");
                      }}
                    >
                      Send to Sonarr
                    </MenuItem>
                  )}
                  {radarrUrl && (
                    <MenuItem
                      icon={<IoFilm />}
                      onClick={() => {
                        if (magnetURL) mutateRadarr(magnetURL);
                        else if (onSelect) callbackMutation("radarr");
                      }}
                    >
                      Send to Radarr
                    </MenuItem>
                  )}
                </MenuList>
              </Menu>
            )}
          </ButtonGroup>
        </Flex>
      </LightMode>
    </Flex>
  );
};

export default TorrentDownloadBox;
